import type { Table, Move } from '../game/table.ts';
import type { Roll } from '../physics/types.ts';
import type { LobbySchema } from '../protocol/messages.ts';
import type { z } from 'zod';

export interface Snapshot {
  readonly table: Table;
  readonly roll: Roll | null;
  readonly room: string | null;
  readonly revision: number;
  readonly playerId: string | null;
  readonly online: readonly string[];
  readonly connection: 'local' | 'connecting' | 'online' | 'reconnecting' | 'closed';
  readonly error: string | null;
  readonly lobby?: z.infer<typeof LobbySchema>;
  readonly invitation?: string;
  readonly suggestedName?: string;
  readonly clockOffset?: number;
}
export interface Session {
  readonly get: () => Snapshot;
  readonly subscribe: (listener: (snapshot: Snapshot) => void) => () => void;
  readonly dispatch: (move: Move) => void;
  readonly close: () => void;
}
export function cell(initial: Snapshot) {
  let current = initial;
  const listeners = new Set<(snapshot: Snapshot) => void>();
  return {
    get: () => current,
    set: (next: Snapshot) => { current = next; for (const listener of listeners) listener(current); },
    subscribe: (listener: (snapshot: Snapshot) => void) => { listeners.add(listener); listener(current); return () => { listeners.delete(listener); }; },
  };
}
