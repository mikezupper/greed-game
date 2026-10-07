import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { Database } from '../../src/server/database.ts';
import { DatabaseSync } from 'node:sqlite';
import { Room } from '../../src/server/room.ts';
import { newTable } from '../../src/game/table.ts';
import { simulate } from '../../src/physics/simulate.ts';
import type { RollRequest } from '../../src/physics/types.ts';
import type { ServerMessage } from '../../src/protocol/messages.ts';
const cleanups: (() => void)[] = [];
afterEach(() => { vi.restoreAllMocks(); cleanups.splice(0).reverse().forEach(fn => fn()); });
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'greed-room-')), db = new Database(join(directory, 'greed.sqlite'));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }), () => db.close());
  let now = 1000; const saved = Room.empty('ABCDEF');
  saved.view.table = { ...newTable([{ id: 'a', name: 'Ada', score: 0 }, { id: 'b', name: 'Ben', score: 0 }]), started: true };
  saved.view.lobby.host = 'a'; saved.view.lobby.clockSeconds = 60;
  saved.claims = {}; saved.view.lobby.host = null;
  // Join with generated test tokens through a lobby, retaining realistic claims.
  saved.view.table = { ...saved.view.table, started: false, match: { ...saved.view.table.match, stage: 'lobby' }, players: [] };
  db.save(saved); const room = new Room(saved, db, { run: simulate }, { now: () => now, playbackMs: 0, graceMs: 30, clockMs: 60 });
  const a: ServerMessage[] = [], b: ServerMessage[] = [], sendA = (m: ServerMessage) => a.push(m), sendB = (m: ServerMessage) => b.push(m);
  const leaveA = room.join('Ada', undefined, sendA), leaveB = room.join('Ben', undefined, sendB);
  const welcome = (messages: ServerMessage[]) => messages.find(m => m.type === 'Welcome') as Extract<ServerMessage, { type: 'Welcome' }>;
  const wa = welcome(a), wb = welcome(b);
  const act = (player: string | null, send: typeof sendA, move: Parameters<Room['act']>[1]['move']) => room.act(player, { type: 'Act', id: crypto.randomUUID(), revision: room.view.revision, move }, send);
  act(wa.playerId, sendA, { type: 'Ready', ready: true }); act(wb.playerId, sendB, { type: 'Ready', ready: true });
  // Host is automatically the first new seat; legacy placeholder isn't present in this fixture.
  return { directory, db, room, a, b, sendA, sendB, wa, wb, act, leaveA, leaveB, setNow: (value: number) => { now = value; } };
}
it('persists no successful move when a disk write fails', () => {
  const s = setup(), before = s.room.view;
  vi.spyOn(s.db, 'save').mockImplementation(() => { throw new Error('disk full'); });
  expect(() => s.act(s.wa.playerId, s.sendA, { type: 'Ready', ready: false })).toThrow('disk full');
  expect(s.room.view).toEqual(before);
});
it('transfers an offline host and applies the disconnect grace once it expires', () => {
  const s = setup(); s.leaveA(); s.setNow(1031); s.room.tick();
  expect(s.room.view.lobby.host).toBe(s.wb.playerId);
});
it('removes an explicitly departed lobby seat and transfers the host', () => {
  const s = setup(); s.act(s.wa.playerId, s.sendA, { type: 'Leave' });
  expect(s.room.view.table.players).toHaveLength(1); expect(s.room.view.lobby.host).toBe(s.wb.playerId);
  expect(s.a.some(m => m.type === 'Left')).toBe(true);
});
it('recovers the original saved seed after a crash during a pending simulation', async () => {
  const s = setup(), saved = s.db.load('ABCDEF'); if (!saved) throw new Error('Missing fixture');
  const first = saved.view.table.players[0]?.id; if (!first) throw new Error('Missing player');
  saved.view.table = { ...newTable(saved.view.table.players), phase: 'rolling', started: true };
  saved.pending = { seed: 3602705804, ids: [0, 1, 2, 3, 4, 5], previous: saved.view };
  s.db.save(saved);
  const seen: RollRequest[] = [];
  const resumed = new Room(s.db.load('ABCDEF')!, s.db, { run: request => { seen.push(request); return simulate(request); } }, { playbackMs: 0 });
  await resumed.finishRoll();
  expect(seen[0]?.seed).toBe(3602705804); expect(resumed.view.roll?.settled).toBe(true);
  expect(s.db.load('ABCDEF')?.pending).toBeNull(); resumed.close();
});
it('keeps an infrastructure-failed launch for retry instead of sampling another seed', async () => {
  const s = setup(), saved = s.db.load('ABCDEF')!;
  saved.view.table = { ...newTable(saved.view.table.players), phase: 'rolling', started: true };
  saved.pending = { seed: 42, ids: [0, 1, 2, 3, 4, 5], previous: saved.view }; s.db.save(saved);
  const room = new Room(saved, s.db, { run: async () => { throw new Error('worker stopped'); } }); await room.finishRoll();
  expect(room.view.lobby.paused).toBe(true); expect(s.db.load('ABCDEF')?.pending?.seed).toBe(42); room.close();
});
it('creates a consistent SQLite backup that can restore seats and scores', () => {
  const s = setup(), file = join(s.directory, 'backup.sqlite'); s.db.backup(file);
  const restored = new Database(file); try { expect(restored.load('ABCDEF')?.view.table).toEqual(s.room.view.table); } finally { restored.close(); }
});
it('advances an opening turn once when its decision clock expires', () => {
  const s = setup(); s.act(s.wa.playerId, s.sendA, { type: 'Start' });
  const before = s.room.view.revision; s.setNow(1061); s.room.tick();
  expect(s.room.view.table.active).toBe(1); expect(s.room.view.revision).toBe(before + 1);
  s.room.tick(); expect(s.room.view.revision).toBe(before + 1);
});
it('banks committed legal points on timeout without keeping uncommitted dice', () => {
  const s = setup(), saved = s.db.load('ABCDEF')!;
  saved.view.table = { ...newTable(saved.view.table.players), phase: 'choosing', started: true, turnScore: 500 };
  saved.view.lobby.deadline = 1060;
  const room = new Room(saved, s.db, { run: simulate }, { now: () => 1061 });
  room.join('Ada', s.wa.token ?? undefined, s.sendA); room.join('Ben', s.wb.token ?? undefined, s.sendB); room.tick();
  expect(room.view.table.players[0]?.score).toBe(500); expect(room.view.table.active).toBe(1); room.close();
});
it('migrates a legacy practice room without losing claims, scores or the original snapshot', () => {
  const s = setup(), saved = s.db.load('ABCDEF')!, old = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>;
  const view = old['view'] as { table: Record<string, unknown>; lobby?: unknown };
  delete old['version']; delete old['disconnected']; delete old['touched']; delete view.table['match']; delete view.lobby;
  const connection = new DatabaseSync(join(s.directory, 'greed.sqlite'));
  try {
    connection.prepare('UPDATE rooms SET data=? WHERE code=?').run(JSON.stringify(old), 'ABCDEF');
    const migrated = s.db.load('ABCDEF'); expect(migrated?.version).toBe(2);
    expect(migrated?.claims).toEqual(saved.claims); expect(migrated?.view.table.players).toEqual(saved.view.table.players);
    expect(connection.prepare('SELECT count(*) AS n FROM legacy_rooms').get()?.['n']).toBe(1);
  } finally { connection.close(); }
});
it('refuses a newer database schema rather than downgrading it', () => {
  const s = setup(), file = join(s.directory, 'future.sqlite'), connection = new DatabaseSync(file);
  connection.exec('PRAGMA user_version=3'); connection.close();
  expect(() => new Database(file)).toThrow('newer app version');
});
