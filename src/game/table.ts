import { hasScore, scoreSelection, type Face } from './scoring.ts';
import { beginMatch, canBank, endTurn, matchState, openingResult, validDice, validPlayers, type Match } from './match.ts';

export interface Player { readonly id: string; readonly name: string; readonly score: number }
export interface Die { readonly id: number; readonly value: Face }
export interface Table {
  readonly players: readonly Player[];
  readonly active: number;
  readonly turn: number;
  readonly phase: 'ready' | 'rolling' | 'choosing' | 'kept' | 'bust';
  readonly started: boolean;
  readonly turnScore: number;
  readonly remaining: readonly number[];
  readonly dice: readonly Die[];
  readonly kept: readonly Die[];
  readonly notice: string;
  readonly match: Match;
}
export type Move = { readonly type: 'Roll' } | { readonly type: 'Keep'; readonly ids: readonly number[] }
  | { readonly type: 'Bank' } | { readonly type: 'Next' } | { readonly type: 'Start' } | { readonly type: 'Rematch' }
  | { readonly type: 'Ready'; readonly ready: boolean } | { readonly type: 'Clock'; readonly enabled: boolean }
  | { readonly type: 'Leave' } | { readonly type: 'Retry' };
export const ALL_DICE = [0, 1, 2, 3, 4, 5] as const;
export const newTable = (players: readonly Player[]): Table => ({
  players, active: 0, turn: 1, phase: 'ready', started: false, turnScore: 0,
  remaining: [...ALL_DICE], dice: [], kept: [], notice: 'Roll six dice to begin.', match: matchState(),
});
export const newMatch = (players: readonly Player[], target = 10_000): Table => ({ ...newTable(players),
  match: matchState('lobby', target), notice: 'Ready up, then start the opening rolls.' });
export type Result = { readonly ok: true; readonly table: Table } | { readonly ok: false; readonly error: string };
const refuse = (error: string): Result => ({ ok: false, error });

export function applyMove(table: Table, player: string, move: Move): Result {
  if (move.type === 'Start') return table.match.stage === 'lobby' && validPlayers(table.players)
    ? { ok: true, table: beginMatch(table) } : refuse('You need two to eight players in the lobby.');
  if (move.type === 'Rematch') return table.match.stage === 'finished'
    ? { ok: true, table: newMatch(table.players.map(p => ({ ...p, score: 0 })), table.match.target) } : refuse('Finish this match first.');
  if (table.match.stage === 'lobby' || table.match.stage === 'finished') return refuse('Start a match from the lobby.');
  if (table.players[table.active]?.id !== player) return refuse('It is not your turn.');
  if (move.type === 'Roll') {
    if (table.players.length < 2) return refuse('Invite another player before rolling.');
    if (table.phase !== 'ready' && table.phase !== 'kept') return refuse('Keep scoring dice before rolling again.');
    return { ok: true, table: { ...table, phase: 'rolling', started: true, dice: [], notice: 'Dice are rolling.' } };
  }
  if (move.type === 'Keep') {
    if (table.match.stage === 'opening') return refuse('Opening dice only decide who starts.');
    if (table.phase !== 'choosing') return refuse('Wait for a roll before keeping dice.');
    const selected = table.dice.filter(d => move.ids.includes(d.id));
    if (new Set(move.ids).size !== move.ids.length || selected.length !== move.ids.length) return refuse('Choose dice from this roll.');
    const score = scoreSelection(selected.map(d => d.value));
    if (score === null) return refuse('Every selected die must belong to a scoring combination.');
    const remaining = table.remaining.filter(id => !move.ids.includes(id));
    const hot = remaining.length === 0;
    return { ok: true, table: { ...table, phase: 'kept', turnScore: table.turnScore + score,
      remaining: hot ? [...ALL_DICE] : remaining, kept: hot ? [] : [...table.kept, ...selected],
      notice: hot ? 'Hot dice! Bank or roll all six again.' : `Kept ${score} points. Bank or roll again.` } };
  }
  if (move.type === 'Bank') {
    if (table.phase !== 'kept') return refuse('Keep scoring dice before banking.');
    if (!canBank(table)) return refuse('You need 500 points in one turn to get on the board.');
    return { ok: true, table: endTurn(table, true) };
  }
  if (move.type !== 'Next' || table.phase !== 'bust') return refuse('The turn has not ended.');
  return { ok: true, table: endTurn(table, false) };
}

export function resolveRoll(table: Table, dice: readonly Die[]): Table {
  if (table.phase !== 'rolling' || !validDice(table, dice)) return table;
  if (table.match.stage === 'opening') return openingResult({ ...table, dice }, dice[0]?.value ?? 0);
  const bust = !hasScore(dice.map(d => d.value));
  return { ...table, phase: bust ? 'bust' : 'choosing', dice, turnScore: bust ? 0 : table.turnScore,
    notice: bust ? 'Farkle! Your turn points are lost.' : 'Choose scoring dice to keep.' };
}
