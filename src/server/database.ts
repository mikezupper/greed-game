import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { RoomView, emptyLobby } from '../protocol/messages.ts';
import { matchState } from '../game/match.ts';

export const SavedRoom = z.object({ view: RoomView, claims: z.record(z.string(), z.string()),
  receipts: z.array(z.object({ player: z.string(), id: z.string(), revision: z.number().int(), fingerprint: z.string().optional() })).max(256),
  pending: z.object({ seed: z.number().int().nonnegative(), ids: z.array(z.number().int()), previous: RoomView }).nullable(),
  disconnected: z.record(z.string(), z.number()), touched: z.number(), version: z.literal(2) });
export type SavedRoom = z.infer<typeof SavedRoom>;

export class Database {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    if (Number(this.db.prepare('PRAGMA user_version').get()?.['user_version']) > 2) {
      this.db.close(); throw new Error('This database belongs to a newer app version.');
    }
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)');
    this.db.exec('PRAGMA user_version=2');
  }
  load(code: string): SavedRoom | undefined {
    const row = this.db.prepare('SELECT data FROM rooms WHERE code=?').get(code);
    if (!row) return;
    const raw = JSON.parse(String(row['data'])) as Record<string, unknown>;
    if (raw['version'] !== undefined && raw['version'] !== 1 && raw['version'] !== 2) throw new Error('Unsupported room schema version.');
    if (raw['version'] !== 2) {
      // Preserve the original practice snapshot, then add full-match metadata.
      this.db.exec('CREATE TABLE IF NOT EXISTS legacy_rooms(code TEXT PRIMARY KEY, data TEXT NOT NULL)');
      this.db.prepare('INSERT OR IGNORE INTO legacy_rooms VALUES(?,?)').run(code, String(row['data']));
      const migrateView = (value: unknown) => {
        const view = value as { table: { players: { id: string }[]; started: boolean } };
        return { ...view, table: { ...view.table, match: matchState(view.table.started ? 'playing' : 'lobby') },
          lobby: { ...emptyLobby(), host: view.table.players[0]?.id ?? null } };
      };
      const pending = raw['pending'] as { previous: unknown } | null;
      const migrated = SavedRoom.parse({ ...raw, version: 2, touched: Date.now(), disconnected: {}, view: migrateView(raw['view']),
        pending: pending ? { ...pending, previous: migrateView(pending.previous) } : null });
      this.save(migrated); return migrated;
    }
    return SavedRoom.parse(raw);
  }
  save(room: SavedRoom): void {
    this.db.prepare('INSERT INTO rooms VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated=excluded.updated')
      .run(room.view.code, JSON.stringify(SavedRoom.parse(room)), Date.now());
  }
  exists(code: string): boolean { return !!this.db.prepare('SELECT code FROM rooms WHERE code=?').get(code); }
  prune(before: number): void { this.db.prepare('DELETE FROM rooms WHERE updated < ?').run(before); }
  backup(file: string): void { this.db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`); }
  close(): void { this.db.close(); }
}
