import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
import WebSocket from 'ws';
import { expect, it } from 'vitest';
import { startServer } from '../../src/server/app.ts';
import { Client } from '../helpers/client.ts';
it('serves configured canonical metadata, crawler routes, compressed assets and private invite indexing rules', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'greed-http-'));
  mkdirSync(join(dir, 'assets')); writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Greed</title></head><body>Rules</body></html>');
  writeFileSync(join(dir, 'assets', 'demo.js'), 'console.log("greed")'); writeFileSync(join(dir, 'assets', 'demo.js.gz'), gzipSync('console.log("greed")'));
  const server = await startServer({ port: 0, dataDir: dir, staticDir: dir, publicOrigin: 'https://greed.test' });
  const base = `http://127.0.0.1:${server.port}`;
  try {
    const response = await fetch(`${base}/?room=ABCDEF`), body = await response.text();
    expect(body).toContain('rel="canonical" href="https://greed.test/"'); expect(body).toContain('https://greed.test/social.png');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await (await fetch(`${base}/robots.txt`)).text()).toContain('Sitemap: https://greed.test/sitemap.xml');
    expect(await (await fetch(`${base}/sitemap.xml`)).text()).toContain('<loc>https://greed.test/</loc>');
    const compressed = await fetch(`${base}/assets/demo.js`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(compressed.headers.get('content-encoding')).toBe('gzip'); expect(await compressed.text()).toBe('console.log("greed")');
    const zero = await fetch(`${base}/assets/demo.js`, { headers: { 'Accept-Encoding': 'gzip;q=0' } });
    expect(zero.headers.get('content-encoding')).toBeNull();
  } finally { await server.close(); rmSync(dir, { recursive: true, force: true }); }
});
it('enforces the production message rate and WebSocket payload ceiling', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'greed-limits-')), server = await startServer({ port: 0, dataDir: dir });
  const client = new Client(`127.0.0.1:${server.port}`);
  try {
    await client.ready; for (let i = 0; i < 40; i++) client.socket.send('{broken');
    await client.wait(m => m.type === 'Rejected' && m.message === 'Slow down.');
    const oversized = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    await once(oversized, 'open'); const closed = once(oversized, 'close');
    oversized.send('x'.repeat(4096)); expect((await closed)[0]).toBe(1009);
  } finally { client.close(); await server.close(); rmSync(dir, { recursive: true, force: true }); }
});
