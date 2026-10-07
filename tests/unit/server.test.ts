import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../../src/server/app.ts';
import { Client, createRoom, startMatch, synchronize } from '../helpers/client.ts';
import { scoreSelection } from '../../src/game/scoring.ts';

const directory = mkdtempSync(join(tmpdir(), 'greed-tests-'));
let server: Awaited<ReturnType<typeof startServer>>, base: string;
const clients: Client[] = [];
const connect = () => { const c = new Client(base); clients.push(c); return c; };
beforeAll(async () => { server = await startServer({ port: 0, dataDir: directory, playbackMs: 0, actionRate: 1000 }); base = `127.0.0.1:${server.port}`; });
afterAll(async () => { clients.forEach(c => c.close()); await server.close(); rmSync(directory, { recursive: true, force: true }); });
async function pair() {
  const code = await createRoom(base), a = connect(), b = connect();
  await a.join(code, 'Ada'); await b.join(code, 'Ben'); await startMatch(a, b); return { code, a, b };
}
const activeClient = (a: Client, b: Client) => a.view?.table.players[a.view.table.active]?.id === a.playerId ? a : b;
describe('real authoritative room server', () => {
  it('enforces readiness, host actions, turns, revision checks and idempotent receipts', async () => {
    const code = await createRoom(base), a = connect(), b = connect(); await a.join(code, 'Ada'); await b.join(code, 'Ben');
    await synchronize(a, b); let from = a.messages.length; a.act({ type: 'Start' });
    await a.wait(m => m.type === 'Rejected' && m.message.includes('ready'), from);
    from = b.messages.length; b.act({ type: 'Clock', enabled: true }); await b.wait(m => m.type === 'Rejected' && m.message.includes('host'), from);
    await startMatch(a, b); const current = activeClient(a, b), other = current === a ? b : a;
    from = other.messages.length; other.act({ type: 'Roll' }); await other.wait(m => m.type === 'Rejected', from);
    const previousSeed = current.view?.roll?.seed; from = current.messages.length;
    const command = current.act({ type: 'Roll' }); current.send(command);
    await current.wait(m => m.type === 'Snapshot' && m.view.roll?.seed !== previousSeed && m.view.table.phase !== 'rolling', from);
    await synchronize(a, b); expect(a.view?.roll).toEqual(b.view?.roll); expect(a.view?.roll?.settled).toBe(true);
    from = current.messages.length; current.send(command);
    const ack = await current.wait(m => m.type === 'Ack' && m.id === command.id, from);
    expect(ack.type === 'Ack' && ack.revision).toBe(command.revision + 1);
    from = current.messages.length; current.send({ ...command, move: { type: 'Bank' } });
    await current.wait(m => m.type === 'Rejected' && m.message.includes('different command'), from);
    from = current.messages.length; current.send({ ...command, id: crypto.randomUUID(), revision: 0 });
    await current.wait(m => m.type === 'Rejected', from);
  });
  it('restores a seat, replaces older tabs, and keeps late spectators read-only', async () => {
    const { code, a, b } = await pair();
    const current = activeClient(a, b), token = current.token, id = current.playerId, roll = current.view?.roll;
    const back = connect(); await back.join(code, 'Returning', token);
    await current.wait(m => m.type === 'Replaced'); expect(back.playerId).toBe(id); expect(back.view?.roll).toEqual(roll);
    const from = current.messages.length; current.act({ type: 'Roll' });
    await current.wait(m => m.type === 'Rejected' && m.message.includes('another tab'), from);
    const spectator = connect(); await spectator.join(code, 'Watcher'); expect(spectator.playerId).toBeNull();
    spectator.act({ type: 'Roll' }); await spectator.wait(m => m.type === 'Rejected' && m.message.includes('Spectators'));
  });
  it('plays an entire real-physics 10,000-point match and opens a rematch lobby', async () => {
    const { a, b } = await pair();
    for (let count = 0; count < 4000 && a.view?.table.match.stage !== 'finished'; count++) {
      await synchronize(a, b); const client = activeClient(a, b), table = client.view?.table;
      if (!table) throw new Error('Missing table.');
      let move: Parameters<Client['act']>[0];
      if (table.phase === 'ready' || (table.phase === 'kept' && table.turnScore < 500)) move = { type: 'Roll' };
      else if (table.phase === 'choosing') {
        let ids: number[] = [], best = -1;
        for (let mask = 1; mask < 1 << table.dice.length; mask++) {
          const selection = table.dice.filter((_, i) => mask & (1 << i)), score = scoreSelection(selection.map(d => d.value));
          if (score !== null && score > best) { best = score; ids = selection.map(d => d.id); }
        }
        move = { type: 'Keep', ids };
      } else move = { type: table.phase === 'bust' ? 'Next' : 'Bank' };
      const from = client.messages.length, revision = client.view?.revision ?? 0; client.act(move);
      await client.wait(m => m.type === 'Snapshot' && m.view.revision > revision && m.view.table.phase !== 'rolling', from);
      await synchronize(a, b);
    }
    expect(a.view?.table.match.stage).toBe('finished'); expect(a.view?.table.match.winners).toHaveLength(1);
    expect(a.view?.table).toEqual(b.view?.table);
    const from = a.messages.length; a.act({ type: 'Rematch' });
    await a.wait(m => m.type === 'Snapshot' && m.view.table.match.stage === 'lobby', from);
    expect(a.view?.table.players.every(p => p.score === 0)).toBe(true); expect(a.view?.lobby.ready).toEqual([]);
  }, 60_000);
  it('rejects malformed commands, hostile origins and path traversal', async () => {
    const client = connect(); await client.ready; client.socket.send('{broken'); await client.wait(m => m.type === 'Rejected');
    expect((await fetch(`http://${base}/api/rooms`, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status).toBe(403);
    expect((await fetch(`http://${base}/%2e%2e/%2e%2e/etc/passwd`)).status).toBe(404);
  });
  it('preserves a match, seat, recorded trajectory and receipts across server restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'greed-restart-'));
    let app = await startServer({ port: 0, dataDir: dir, playbackMs: 0 }), address = `127.0.0.1:${app.port}`;
    const code = await createRoom(address), a = new Client(address), b = new Client(address); let back: Client | undefined;
    try {
      await a.join(code, 'Ada'); await b.join(code, 'Ben'); await startMatch(a, b);
      const current = activeClient(a, b), from = current.messages.length, command = current.act({ type: 'Roll' });
      await current.wait(m => m.type === 'Snapshot' && m.view.table.phase !== 'rolling', from);
      const token = current.token, roll = current.view?.roll, id = current.playerId;
      a.close(); b.close(); await app.close();
      app = await startServer({ port: 0, dataDir: dir, playbackMs: 0 }); address = `127.0.0.1:${app.port}`;
      back = new Client(address); await back.join(code, 'Returning', token);
      expect(back.playerId).toBe(id); expect(back.view?.roll).toEqual(roll);
      back.send(command); const receipt = await back.wait(m => m.type === 'Ack' && m.id === command.id);
      expect(receipt.type === 'Ack' && receipt.revision).toBe(command.revision + 1);
    } finally { a.close(); b.close(); back?.close(); await app.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
