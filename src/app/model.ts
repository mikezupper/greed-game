import type { Table } from '../game/table.ts';
import { scoreSelection } from '../game/scoring.ts';
import { canBank } from '../game/match.ts';
import { BUST_CHANCE } from '../game/odds.ts';
import type { Snapshot } from '../state/session.ts';

/** A short-lived table event the view celebrates: a bank, a Farkle or hot dice. */
export interface Moment { readonly kind: 'bank' | 'farkle' | 'hot'; readonly key: number; readonly player: string; readonly points: number }
export interface State {
  readonly snapshot: Snapshot; readonly selected: readonly number[]; readonly name: string; readonly room: string;
  readonly error: string | null; readonly names: readonly string[]; readonly now: number; readonly playing: boolean;
  readonly sound: boolean; readonly hints: boolean; readonly moment: Moment | null;
}
export type Msg = { readonly _tag: 'Changed'; readonly snapshot: Snapshot } | { readonly _tag: 'Pick'; readonly id: number }
  | { readonly _tag: 'Roll' } | { readonly _tag: 'Bank' } | { readonly _tag: 'Next' }
  | { readonly _tag: 'Name'; readonly value: string } | { readonly _tag: 'Room'; readonly value: string }
  | { readonly _tag: 'SeatName'; readonly index: number; readonly value: string } | { readonly _tag: 'AddSeat' } | { readonly _tag: 'RemoveSeat'; readonly index: number }
  | { readonly _tag: 'Create' } | { readonly _tag: 'Join' } | { readonly _tag: 'Local' } | { readonly _tag: 'NewTable' } | { readonly _tag: 'Copy' }
  | { readonly _tag: 'StartLocal' } | { readonly _tag: 'Start' } | { readonly _tag: 'Rematch' } | { readonly _tag: 'Ready' } | { readonly _tag: 'Clock' }
  | { readonly _tag: 'Leave' } | { readonly _tag: 'Retry' } | { readonly _tag: 'Suggest' } | { readonly _tag: 'Sound' } | { readonly _tag: 'Hints' }
  | { readonly _tag: 'Playback'; readonly playing: boolean } | { readonly _tag: 'Tick'; readonly now: number }
  | { readonly _tag: 'Failed'; readonly message: string };

export const fmt = (n: number): string => n.toLocaleString('en-US');
export const risk = (dice: number): string => {
  const percent = (BUST_CHANCE[dice] ?? 0) * 100;
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent)}% Farkle risk`;
};
export const owns = (s: State): boolean => s.snapshot.connection === 'local'
  || (s.snapshot.connection === 'online' && s.snapshot.table.players[s.snapshot.table.active]?.id === s.snapshot.playerId);
export const busy = (s: State): boolean => s.playing || s.now + (s.snapshot.clockOffset ?? 0) < (s.snapshot.lobby?.playbackUntil ?? 0);
export type Screen = 'start' | 'waiting' | 'table';
export const screenOf = (snapshot: Snapshot): Screen => snapshot.table.match.stage !== 'lobby' ? 'table'
  : snapshot.connection === 'local' ? 'start' : 'waiting';

/** The current selection, its score, and the dice a Bank or Roll would commit with it. */
export function selection(s: State): { readonly values: readonly number[]; readonly score: number | null; readonly keep: readonly number[] | undefined } {
  const table = s.snapshot.table, chosen = table.dice.filter(d => s.selected.includes(d.id));
  const score = scoreSelection(chosen.map(d => d.value));
  const keep = table.phase === 'choosing' && score !== null ? chosen.map(d => d.id).sort((a, b) => a - b) : undefined;
  return { values: chosen.map(d => d.value).sort((a, b) => a - b), score, keep };
}
/** Whether banking now is legal, counting a selection that Bank would commit first. */
export function bankable(table: Table, extra: number): boolean {
  return canBank({ ...table, turnScore: table.turnScore + extra });
}
/** Best-scoring legal selection, used by the "Select scoring dice" helper. */
export function bestSelection(table: Table): readonly number[] {
  let selected: number[] = [], best = -1;
  for (let mask = 1; mask < 1 << table.dice.length; mask++) {
    const subset = table.dice.filter((_, index) => mask & (1 << index)), score = scoreSelection(subset.map(d => d.value));
    if (score !== null && score >= best) { best = score; selected = subset.map(d => d.id); }
  }
  return selected;
}

/** Compare consecutive snapshots to find what just happened at the table. */
export function moment(previous: Snapshot, next: Snapshot, current: Moment | null): Moment | null {
  const before = previous.table, after = next.table, key = next.revision;
  if (previous.revision === 0 || before.match.stage === 'lobby') return null;
  if (after.turn !== before.turn) {
    const gained = after.players.find(p => p.score > (before.players.find(q => q.id === p.id)?.score ?? p.score));
    const old = before.players.find(q => q.id === gained?.id)?.score ?? 0;
    return gained ? { kind: 'bank', key, player: gained.id, points: gained.score - old } : null;
  }
  const player = after.players[after.active]?.id ?? '';
  if (after.phase === 'bust' && before.phase !== 'bust') return { kind: 'farkle', key, player, points: before.turnScore };
  if (before.phase === 'choosing' && after.remaining.length === 6 && after.kept.length === 0 && after.turnScore > 0)
    return { kind: 'hot', key, player, points: after.turnScore };
  return current;
}
