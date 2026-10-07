import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../src/server/app.ts';
import { Client, createRoom, startMatch, synchronize } from '../tests/helpers/client.ts';
const directory = mkdtempSync(join(tmpdir(), 'greed-load-'));
const server = await startServer({ port: 0, dataDir: directory, playbackMs: 0 }), base = `127.0.0.1:${server.port}`;
const clients: Client[] = [], pairs: [Client, Client][] = [];
try {
  for (let room = 0; room < 8; room++) {
    const code = await createRoom(base), a = new Client(base), b = new Client(base); clients.push(a, b);
    await a.join(code, `Ada ${room}`); await b.join(code, `Ben ${room}`); await startMatch(a, b); pairs.push([a, b]);
  }
  const times = await Promise.all(pairs.map(async ([a, b]) => {
    const active = a.view?.table.players[a.view.table.active]?.id === a.playerId ? a : b;
    const from = active.messages.length, start = performance.now(); active.act({ type: 'Roll' });
    await active.wait(m => m.type === 'Snapshot' && m.view.table.phase !== 'rolling', from); await synchronize(a, b);
    assert.deepEqual(a.view?.roll, b.view?.roll); assert.equal(a.view?.roll?.settled, true);
    return performance.now() - start;
  }));
  times.sort((a, b) => a - b);
  const report = { measuredAt: new Date().toISOString(), concurrentRooms: 8, realClients: clients.length,
    resultLatencyMs: { p50: times[3], p95: times[7], max: times[7] }, processRssMiB: process.memoryUsage().rss / 1048576,
    sameResultAcrossEachPair: true, limits: 'Single machine; warmed worker; 8 simultaneous throws, not sustained capacity. Playback delay disabled. Production command rate retained.' };
  writeFileSync('docs/generated/load-report.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { clients.forEach(c => c.close()); await server.close(); rmSync(directory, { recursive: true, force: true }); }
