import { applyMove, newMatch, resolveRoll } from '../game/table.ts';
import { emptyLobby, RollSchema, TableSchema } from '../protocol/messages.ts';
import type { Roll, RollRequest } from '../physics/types.ts';
import { cell, type Session, type Snapshot } from './session.ts';

const KEY = 'greed:local:v2';
export function localSession(names?: readonly string[]): Session {
  let snapshot: Snapshot = { table: newMatch((names ?? ['Player 1', 'Player 2']).map((name, i) => ({ id: `local-${i + 1}`, name, score: 0 }))),
    roll: null, revision: 0, room: null, playerId: 'local-1', online: [], connection: 'local', error: null, lobby: emptyLobby() };
  let pending: RollRequest | null = null, stopped = false;
  if (!names) try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { table?: unknown; roll?: unknown; pending?: RollRequest } | null;
    if (raw) { snapshot = { ...snapshot, table: TableSchema.parse(raw.table), roll: raw.roll ? RollSchema.parse(raw.roll) : null }; pending = raw.pending ?? null; }
  } catch { snapshot = { ...snapshot, error: 'The saved local match could not be read. A new table is ready.' }; }
  const state = cell(snapshot);
  let worker: Worker | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
  const publish = (next: Snapshot) => {
    if (stopped) return;
    const table = next.table;
    const result = { ...next, playerId: table.players[table.active]?.id ?? null };
    try { localStorage.setItem(KEY, JSON.stringify({ table, roll: next.roll, pending })); } catch { /* Private browsing or storage quota may disable saving. */ }
    state.set(result);
  };
  const failed = (message: string) => {
    clearTimeout(timeout); worker?.terminate(); worker = undefined;
    publish({ ...state.get(), lobby: { ...emptyLobby(), paused: true }, error: message });
  };
  const launch = () => {
    if (!pending || stopped) return;
    worker ??= new Worker(new URL('../physics/browser-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<{ roll?: Roll; error?: string }>) => {
      clearTimeout(timeout); if (stopped) return;
      if (!data.roll?.settled) { failed(data.error ?? 'This roll is saved but has not settled. Retry the same launch or start a new match.'); return; }
      pending = null;
      publish({ ...state.get(), roll: data.roll, revision: state.get().revision + 1,
        table: resolveRoll(state.get().table, data.roll.dice), lobby: emptyLobby(), error: null });
    };
    worker.onerror = () => failed('The dice worker stopped. Retry the saved launch.');
    timeout = setTimeout(() => failed('The dice worker took too long. Retry the saved launch.'), 15_000);
    worker.postMessage(pending);
  };
  if (pending) launch();
  return { ...state,
    dispatch: move => {
      const current = state.get();
      if (move.type === 'Retry' && pending) { publish({ ...current, lobby: emptyLobby(), error: null }); launch(); return; }
      const result = move.type === 'Rematch' && current.lobby?.paused
        ? { ok: true as const, table: newMatch(current.table.players.map(p => ({ ...p, score: 0 }))) }
        : applyMove(current.table, current.table.players[current.table.active]?.id ?? '', move);
      if (!result.ok) { publish({ ...current, error: result.error }); return; }
      if (move.type === 'Roll') pending = { seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 0, ids: result.table.remaining };
      if (move.type === 'Rematch') { pending = null; worker?.terminate(); worker = undefined; }
      publish({ ...current, table: result.table, revision: current.revision + 1, error: null,
        ...(move.type === 'Rematch' ? { roll: null, lobby: emptyLobby() } : {}) });
      if (move.type === 'Roll') launch();
    },
    close: () => { stopped = true; clearTimeout(timeout); worker?.terminate(); },
  };
}
