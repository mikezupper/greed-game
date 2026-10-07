import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, createRoom, startMatch } from '../tests/helpers/client.ts';

const image = process.argv[2] ?? 'greed-dice-game:latest';
const name = `greed-scaffold-check-${process.pid}`, volume = `${name}-data`;
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const clients: Client[] = [];
try {
  docker('volume', 'create', volume);
  docker('run', '-d', '--read-only', '--tmpfs', '/tmp:size=32m', '--memory', '512m', '--cpus', '1', '--pids-limit', '128', '--name', name, '-p', '127.0.0.1::8787', '--mount', `type=volume,source=${volume},target=/app/.data`, image);
  let address = docker('port', name, '8787/tcp');
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`http://${address}/healthz`)).ok) return; } catch { /* Process may still be starting. */ }
      await delay(100);
    }
    throw new Error('Container did not become healthy.');
  };
  await ready();
  const response = await fetch(`http://${address}/`);
  assert.equal(response.status, 200); assert.match(await response.text(), /One more roll/);
  const room = await createRoom(address);
  const a = new Client(address), b = new Client(address); clients.push(a, b);
  await a.join(room, 'Ada'); await b.join(room, 'Ben');
  await a.wait(m => m.type === 'Snapshot' && m.view.table.players.length === 2);
  const token = a.token, player = a.playerId; assert(token);
  await startMatch(a, b, true);
  const current = a.view?.table.players[a.view.table.active]?.id === a.playerId ? a : b;
  await delay(Math.max(0, (current.view?.lobby.playbackUntil ?? 0) - Date.now()) + 10);
  const from = current.messages.length; current.act({ type: 'Roll' });
  await current.wait(m => m.type === 'Snapshot' && m.view.table.phase !== 'rolling', from);
  const roll = current.view?.roll; assert(roll?.settled);
  docker('exec', name, 'node', 'scripts/backup.ts', '/app/.data/greed.sqlite', '/app/.data/smoke-backup.sqlite');
  a.close(); b.close();
  docker('stop', '--time', '10', name); docker('start', name);
  address = docker('port', name, '8787/tcp'); await ready();
  const rejoined = new Client(address); clients.push(rejoined); await rejoined.join(room, 'Ada', token);
  assert.equal(rejoined.playerId, player); assert.deepEqual(rejoined.view?.roll, roll);
  const report = { measuredAt: new Date().toISOString(), imageId: docker('image', 'inspect', image, '--format', '{{.Id}}'),
    node: docker('exec', name, 'node', '--version'), uid: docker('exec', name, 'id', '-u'),
    health: true, staticClient: true, guestRooms: true, workerRoll: true, liveBackup: true, readOnlyRoot: true, resourceLimits: true, persistedSeatAndTrajectoryAfterRestart: true };
  assert.notEqual(report.uid, '0');
  writeFileSync('docs/generated/container-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch (error) {
  try { console.error(docker('logs', name)); } catch { /* Container may not exist yet. */ }
  throw error;
} finally {
  clients.forEach(client => client.close());
  try { docker('rm', '-f', name); } catch { /* Clean up partial startup too. */ }
  try { docker('volume', 'rm', volume); } catch { /* Preserve the original failure. */ }
}
