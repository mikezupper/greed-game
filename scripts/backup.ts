import { backup, DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const source = process.argv[2], target = process.argv[3];
if (!source || !target) throw new Error('Usage: npm run backup -- source.sqlite new-backup.sqlite');
if (!existsSync(source)) throw new Error('Source database does not exist.');
if (existsSync(target)) throw new Error('Choose a new backup filename; existing backups are never overwritten.');
mkdirSync(dirname(resolve(target)), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  const copy = new DatabaseSync(target, { readOnly: true });
  try { if (copy.prepare('PRAGMA integrity_check').get()?.['integrity_check'] !== 'ok') throw new Error('Backup integrity check failed.'); }
  finally { copy.close(); }
  console.log(JSON.stringify({ event: 'backup_complete', file: resolve(target) }));
} finally { db.close(); }
