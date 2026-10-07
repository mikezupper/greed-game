import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { applyMove, newMatch, resolveRoll } from '../game/table.ts';
import { expireTurn } from '../game/match.ts';
import { emptyLobby, type ClientMessage, type RoomView, type ServerMessage } from '../protocol/messages.ts';
import { Database, type SavedRoom } from './database.ts';
import type { PhysicsPool } from './physics-pool.ts';

interface Connection { send: (message: ServerMessage) => void; player: string | null; replaced: boolean }
export interface RoomOptions { readonly now?: () => number; readonly seed?: () => number; readonly playbackMs?: number; readonly graceMs?: number; readonly clockMs?: number }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export class Room {
  private saved: SavedRoom;
  private members = new Set<Connection>();
  private database: Database;
  private physics: Pick<PhysicsPool, 'run'>;
  private closed = false;
  private running = false;
  private retryAt = 0;
  private now: () => number;
  private options: RoomOptions;
  private activity: number;
  constructor(saved: SavedRoom, database: Database, physics: Pick<PhysicsPool, 'run'>, options: RoomOptions = {}) {
    this.saved = saved; this.database = database; this.physics = physics; this.options = options;
    this.now = options.now ?? Date.now; this.activity = this.now();
    this.saved = { ...saved, disconnected: Object.fromEntries(saved.view.table.players.map(p => [p.id, saved.disconnected[p.id] ?? this.now()])) };
  }
  static empty(code: string, target = 10_000): SavedRoom {
    return { version: 2, touched: Date.now(), disconnected: {}, view: { code, revision: 0, table: newMatch([], target), online: [], roll: null, lobby: emptyLobby() },
      claims: {}, receipts: [], pending: null };
  }
  get view(): RoomView { return { ...this.saved.view, online: [...new Set([...this.members].flatMap(m => m.player && !m.replaced ? [m.player] : []))] }; }
  get idleSince(): number { return this.activity; }
  get connections(): number { return this.members.size; }
  private commit(next: SavedRoom): void {
    this.database.save(next); this.saved = next; this.broadcast();
  }
  private broadcast(): void { for (const member of this.members) if (!member.replaced) member.send({ type: 'Snapshot', view: this.view, serverTime: this.now() }); }
  private update(view: RoomView, extra: Partial<SavedRoom> = {}): void {
    this.commit({ ...this.saved, ...extra, touched: this.now(), view: { ...view, revision: this.saved.view.revision + 1 } });
  }
  join(name: string, token: string | undefined, send: Connection['send']): () => void {
    this.activity = this.now();
    let player = token ? Object.entries(this.saved.claims).find(([, h]) => h === hash(token))?.[0] ?? null : null;
    let issued = player ? token ?? null : null;
    let table = this.saved.view.table, claims = this.saved.claims;
    if (!player && table.match.stage === 'lobby' && table.players.length < 8) {
      player = randomUUID(); issued = randomBytes(24).toString('base64url');
      const names = new Set(table.players.map(p => p.name));
      let unique = name, suffix = 2; while (names.has(unique)) unique = `${name.slice(0, 20)} ${suffix++}`;
      table = { ...table, players: [...table.players, { id: player, name: unique, score: 0 }] };
      claims = { ...claims, [player]: hash(issued) };
    }
    // Persist before replacing an existing seat connection or welcoming a new one.
    const disconnected = { ...this.saved.disconnected }; if (player) delete disconnected[player];
    const lobby = { ...this.saved.view.lobby, host: this.saved.view.lobby.host ?? player,
      departed: this.saved.view.lobby.departed.filter(id => id !== player) };
    this.database.save({ ...this.saved, claims, disconnected, touched: this.now(),
      view: { ...this.saved.view, table, lobby, revision: this.saved.view.revision + 1 } });
    this.saved = { ...this.saved, claims, disconnected, touched: this.now(),
      view: { ...this.saved.view, table, lobby, revision: this.saved.view.revision + 1 } };
    if (player) for (const member of this.members) if (member.player === player && !member.replaced) {
      member.replaced = true; member.send({ type: 'Replaced' });
    }
    const connection: Connection = { player, send, replaced: false }; this.members.add(connection);
    send({ type: 'Welcome', playerId: player, token: issued }); this.broadcast();
    return () => {
      this.members.delete(connection);
      if (this.closed || connection.replaced) return;
      this.activity = this.now();
      if (player && !this.view.online.includes(player) && this.saved.view.table.players.some(p => p.id === player)) {
        try { this.update(this.saved.view, { disconnected: { ...this.saved.disconnected, [player]: this.now() } }); }
        catch { console.error(JSON.stringify({ event: 'disconnect_save_failed', room: this.saved.view.code })); }
      } else this.broadcast();
    };
  }
  act(player: string | null, message: Extract<ClientMessage, { type: 'Act' }>, send: Connection['send']): void {
    this.activity = this.now();
    const reject = (text: string) => send({ type: 'Rejected', id: message.id, message: text });
    if (!player) return reject('Spectators cannot play.');
    if (![...this.members].some(m => m.player === player && m.send === send && !m.replaced)) return reject('This seat is controlled by another tab.');
    const receipt = this.saved.receipts.find(r => r.player === player && r.id === message.id);
    const fingerprint = JSON.stringify({ revision: message.revision, move: message.move });
    if (receipt) return receipt.fingerprint && receipt.fingerprint !== fingerprint
      ? reject('This action ID was already used for a different command.') : send({ type: 'Ack', id: message.id, revision: receipt.revision });
    if (message.revision !== this.saved.view.revision) { send({ type: 'Snapshot', view: this.view, serverTime: this.now() }); return reject('The table changed. Review it and try again.'); }
    const move = message.move, view = this.saved.view, stage = view.table.match.stage;
    const host = view.lobby.host === player;
    if (['Start', 'Rematch', 'Clock'].includes(move.type) && !host) return reject('Only the room host can do that.');
    let next = view, claims = this.saved.claims, disconnected = this.saved.disconnected, pending = this.saved.pending;
    if (move.type === 'Ready') {
      if (stage !== 'lobby') return reject('Readiness is set in the lobby.');
      next = { ...view, lobby: { ...view.lobby, ready: move.ready ? [...new Set([...view.lobby.ready, player])] : view.lobby.ready.filter(id => id !== player) } };
    } else if (move.type === 'Clock') {
      if (stage !== 'lobby') return reject('Set the clock before starting.');
      next = { ...view, lobby: { ...view.lobby, clockSeconds: move.enabled ? 60 : 0 } };
    } else if (move.type === 'Leave') {
      if (stage === 'lobby') {
        claims = Object.fromEntries(Object.entries(claims).filter(([id]) => id !== player));
        const players = view.table.players.filter(p => p.id !== player);
        next = { ...view, table: { ...view.table, players, active: 0 }, lobby: { ...view.lobby,
          host: host ? players.find(p => this.view.online.includes(p.id))?.id ?? players[0]?.id ?? null : view.lobby.host,
          ready: view.lobby.ready.filter(id => id !== player) } };
      } else {
        disconnected = { ...disconnected, [player]: this.now() - (this.options.graceMs ?? 30_000) };
        next = { ...view, lobby: { ...view.lobby, departed: [...new Set([...view.lobby.departed, player])] } };
        if (view.table.players[view.table.active]?.id === player && !pending) next = this.timed({ ...next, table: expireTurn(view.table) });
      }
    } else if (move.type === 'Retry') {
      if (!pending || !view.lobby.paused || view.table.players[view.table.active]?.id !== player) return reject('There is no saved roll to retry.');
      next = { ...view, lobby: { ...view.lobby, paused: false } };
    } else {
      if (view.lobby.playbackUntil > this.now()) return reject('Wait for the dice to settle on screen.');
      if (move.type === 'Start' && !view.table.players.every(p => view.lobby.ready.includes(p.id) && this.view.online.includes(p.id))) return reject('Everyone must be connected and ready.');
      const result = move.type === 'Rematch' && view.lobby.paused
        ? { ok: true as const, table: newMatch(view.table.players.map(p => ({ ...p, score: 0 })), view.table.match.target) }
        : applyMove(view.table, player, move);
      if (!result.ok) return reject(result.error);
      pending = move.type === 'Roll' ? { seed: (this.options.seed ?? (() => randomInt(4294967296)))(), ids: [...result.table.remaining], previous: view } : null;
      next = this.timed({ ...view, table: result.table,
        ...(move.type === 'Rematch' ? { roll: null, lobby: { ...view.lobby, ready: [], departed: [], paused: false } } : {}) });
    }
    const revision = view.revision + 1;
    this.commit({ ...this.saved, claims, disconnected, pending, touched: this.now(), view: { ...next, revision },
      receipts: [...this.saved.receipts, { player, id: message.id, revision, fingerprint }].slice(-256) });
    send({ type: 'Ack', id: message.id, revision });
    if (move.type === 'Leave') {
      for (const member of this.members) if (member.player === player) { member.replaced = true; member.send({ type: 'Left' }); }
      this.broadcast();
    }
    if (pending && !next.lobby.paused) void this.finishRoll();
  }
  private timed(view: RoomView, playback = 0): RoomView {
    const inactive = ['lobby', 'finished'].includes(view.table.match.stage) || view.table.phase === 'rolling';
    return { ...view, lobby: { ...view.lobby, playbackUntil: playback ? this.now() + playback : 0,
      deadline: !inactive && view.lobby.clockSeconds ? this.now() + playback + (this.options.clockMs ?? 60_000) : null } };
  }
  async finishRoll(): Promise<void> {
    const pending = this.saved.pending; if (!pending || this.running || this.closed || this.saved.view.lobby.paused) return;
    const revision = this.saved.view.revision; this.running = true;
    try {
      const roll = await this.physics.run(pending);
      if (this.closed || this.saved.pending !== pending) return;
      if (!roll.settled) throw new Error('A die is still cocked. The original roll has been saved.');
      const view = this.timed({ ...this.saved.view, table: resolveRoll(this.saved.view.table, roll.dice), roll }, Math.min(this.options.playbackMs ?? 4000, roll.steps * roll.dt * 1000));
      this.update(view, { pending: null });
    } catch (error) {
      if (this.closed || this.saved.pending !== pending) return;
      try { this.update({ ...this.saved.view, lobby: { ...this.saved.view.lobby, paused: true },
        table: { ...this.saved.view.table, notice: `${error instanceof Error ? error.message : 'Dice service unavailable.'} Retry preserves the same launch.` } }); }
      catch { this.retryAt = this.now() + 5000; console.error(JSON.stringify({ event: 'roll_save_failed', room: this.saved.view.code, revision })); }
    } finally { this.running = false; }
  }
  tick(): void {
    if (this.closed) return;
    const view = this.saved.view, online = this.view.online, now = this.now(), grace = this.options.graceMs ?? 30_000;
    if (this.saved.pending && !this.running && !view.lobby.paused && now >= this.retryAt) void this.finishRoll();
    try {
      if (view.lobby.host && !online.includes(view.lobby.host) && now - (this.saved.disconnected[view.lobby.host] ?? now) >= grace) {
        const host = view.table.players.find(p => online.includes(p.id))?.id;
        if (host) this.update({ ...view, lobby: { ...view.lobby, host } });
      }
      const current = this.saved.view, active = current.table.players[current.table.active]?.id;
      const offline = active && (!online.includes(active) || current.lobby.departed.includes(active))
        && now - (this.saved.disconnected[active] ?? now) >= grace;
      if (!this.saved.pending && current.lobby.playbackUntil <= now && !['lobby', 'finished'].includes(current.table.match.stage)
        && (offline || (current.lobby.deadline !== null && current.lobby.deadline <= now))) {
        this.update(this.timed({ ...current, table: expireTurn(current.table) }));
      }
    } catch { console.error(JSON.stringify({ event: 'room_tick_save_failed', room: view.code })); }
  }
  close(): void { this.closed = true; this.members.clear(); }
}
