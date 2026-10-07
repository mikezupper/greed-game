import { startServer } from './app.ts';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');

const app = await startServer({ port: Number(process.env['PORT'] ?? 8787), host: process.env['HOST'] ?? '127.0.0.1', dataDir: process.env['DATA_DIR'] ?? '.data',
  staticDir: process.env['STATIC_DIR'] ?? 'dist', publicOrigin: process.env['PUBLIC_ORIGIN'] || undefined, trustedProxy: process.env['TRUSTED_PROXY'] || undefined });
console.log(JSON.stringify({ event: 'listening', port: app.port }));
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; void app.close().then(() => process.exit(0)); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
