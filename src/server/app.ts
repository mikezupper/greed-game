import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { mkdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { isIP } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, type ServerMessage } from '../protocol/messages.ts';
import { Database } from './database.ts';
import { Room, type RoomOptions } from './room.ts';
import { PhysicsPool } from './physics-pool.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export interface ServerOptions extends RoomOptions { readonly port?: number; readonly host?: string; readonly dataDir: string; readonly staticDir?: string; readonly publicOrigin?: string; readonly matchTarget?: number; readonly idleMs?: number; readonly actionRate?: number; readonly trustedProxy?: string }
export async function startServer(options: ServerOptions) {
  const publicOrigin = options.publicOrigin ? new URL(options.publicOrigin).origin : undefined;
  if (options.publicOrigin && (publicOrigin !== options.publicOrigin || !/^https?:/.test(publicOrigin))) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a path or trailing slash.');
  if (options.trustedProxy && !isIP(options.trustedProxy)) throw new Error('TRUSTED_PROXY must be one explicit proxy IP address.');
  mkdirSync(options.dataDir, { recursive: true });
  const database = new Database(resolve(options.dataDir, 'greed.sqlite'));
  const physics = new PhysicsPool();
  const rooms = new Map<string, Room>();
  const creations = new Map<string, number[]>();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: { threshold: 1024 } });
  const originAllowed = (origin: string | undefined, host: string | undefined) => !origin || (options.publicOrigin
    ? origin === options.publicOrigin : [`http://${host}`, 'http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin));
  const server = createServer(async (req, res) => {
    const json = (status: number, value: unknown) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      if (req.url === '/healthz') { res.end('ok'); return; }
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' }); res.end(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ws\n${publicOrigin ? `Sitemap: ${publicOrigin}/sitemap.xml\n` : ''}`); return;
      }
      if (req.url === '/sitemap.xml') {
        if (!publicOrigin) return json(503, { error: 'Configure PUBLIC_ORIGIN before publishing a sitemap.' });
        res.writeHead(200, { 'content-type': 'application/xml' }); res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${publicOrigin}/</loc></url></urlset>`); return;
      }
      if (req.url === '/api/rooms' && req.method === 'POST') {
        if (!originAllowed(req.headers.origin, req.headers.host)) return json(403, { error: 'Origin refused.' });
        let address = (req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, ''); const now = Date.now();
        const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').at(-1)?.trim();
        if (options.trustedProxy === address && forwarded && isIP(forwarded)) address = forwarded;
        const recent = (creations.get(address) ?? []).filter(t => now - t < 3_600_000);
        if (recent.length >= 20 || rooms.size >= 256) return json(429, { error: 'Too many rooms. Try again later.' });
        creations.set(address, [...recent, now]);
        let code: string;
        do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (database.exists(code));
        const saved = Room.empty(code, options.matchTarget); database.save(saved);
        rooms.set(code, new Room(saved, database, physics, options));
        return json(201, { room: code });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Method not allowed.' });
      const root = resolve(options.staticDir ?? 'dist');
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
      const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
      if (!file.startsWith(root + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) return json(404, { error: 'Not found.' });
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
      let body: Buffer | string = await readFile(file), encoding: string | undefined;
      if (extname(file) === '.html' && publicOrigin) body = body.toString().replace('</head>', `<link rel="canonical" href="${publicOrigin}/"><meta property="og:url" content="${publicOrigin}/"><meta property="og:image" content="${publicOrigin}/social.png"></head>`);
      else for (const [format, suffix] of [['br', '.br'], ['gzip', '.gz']] as const) {
        if (req.headers['accept-encoding']?.split(',').some(e => e.trim().split(';')[0] === format && !/;\s*q=0(?:\.0*)?$/.test(e)) && statSync(file + suffix, { throwIfNoEntry: false })?.isFile()) {
          body = await readFile(file + suffix); encoding = format; break;
        }
      }
      res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'vary': 'Accept-Encoding',
        ...(encoding ? { 'content-encoding': encoding } : {}),
        ...(path === '/' && new URL(req.url ?? '/', 'http://local').searchParams.has('room') ? { 'x-robots-tag': 'noindex' } : {}),
        'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'DENY' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { if (!res.headersSent) json(503, { error: 'The table server could not complete this request.' }); else res.end(); }
  });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws' || sockets.clients.size >= 128 || !originAllowed(req.headers.origin, req.headers.host)) { socket.destroy(); return; }
    sockets.handleUpgrade(req, socket, head, ws => sockets.emit('connection', ws));
  });
  sockets.on('connection', ws => {
    let room: Room | undefined, player: string | null = null, leave: (() => void) | undefined;
    const rate = options.actionRate ?? 10, burst = Math.max(20, rate * 2);
    let tokens = burst, last = Date.now();
    const send = (message: ServerMessage) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 256_000) { ws.close(1013, 'Connection is too slow. Reconnect.'); return; }
      if (message.type === 'Welcome') player = message.playerId;
      ws.send(JSON.stringify(message));
    };
    ws.on('message', raw => {
      try {
        const now = Date.now(); tokens = Math.min(burst, tokens + (now - last) * rate / 1000); last = now;
        if (tokens < 1) { send({ type: 'Rejected', message: 'Slow down.' }); return; } tokens--;
        const decoded = ClientMessage.safeParse(JSON.parse(raw.toString()));
        if (!decoded.success) { send({ type: 'Rejected', message: 'Invalid message.' }); return; }
        const message = decoded.data;
        if (message.type === 'Join') {
          if (room) return;
          room = rooms.get(message.room);
          if (!room) {
            const saved = database.load(message.room);
            if (saved && rooms.size < 256) { room = new Room(saved, database, physics, options); rooms.set(message.room, room); void room.finishRoll(); }
          }
          if (!room) { send({ type: 'Rejected', message: 'That room is unavailable.' }); return; }
          leave = room.join(message.name, message.token, send);
        } else if (room) room.act(player, message, send);
        else send({ type: 'Rejected', message: 'Join a room first.' });
      } catch { send({ type: 'Rejected', message: 'The action could not be saved. Refresh the table.' }); }
    });
    ws.on('error', () => ws.close());
    ws.on('close', () => leave?.());
  });
  const alive = new WeakSet<WebSocket>();
  sockets.on('connection', ws => { alive.add(ws); ws.on('pong', () => alive.add(ws)); });
  const heartbeat = setInterval(() => { for (const ws of sockets.clients) {
    if (!alive.has(ws)) { ws.terminate(); continue; } alive.delete(ws); ws.ping();
  } }, 25_000);
  let nextPrune = 0;
  const maintenance = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      room.tick();
      if (room.connections === 0 && now - room.idleSince > (options.idleMs ?? 300_000)) { room.close(); rooms.delete(code); }
    }
    for (const [address, times] of creations) if (!times.some(t => now - t < 3_600_000)) creations.delete(address);
    if (now >= nextPrune) {
      nextPrune = now + 60_000;
      try { database.prune(now - 86_400_000); } catch { console.error(JSON.stringify({ event: 'room_prune_failed' })); }
    }
  }, 250);
  try { await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(options.port ?? 8787, options.host ?? '127.0.0.1', done); }); }
  catch (error) { clearInterval(heartbeat); clearInterval(maintenance); await physics.close(); database.close(); sockets.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address.');
  return { port: address.port, close: async () => {
    clearInterval(heartbeat); clearInterval(maintenance); for (const room of rooms.values()) room.close();
    for (const ws of sockets.clients) ws.terminate();
    await physics.close();
    await new Promise<void>(done => sockets.close(() => done()));
    await new Promise<void>(done => server.close(() => done())); database.close();
  } };
}
