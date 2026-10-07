import { expect, it } from 'vitest';
import { moment, selection, type State } from '../../src/app/model.ts';
import { newTable, type Table } from '../../src/game/table.ts';
import type { Snapshot } from '../../src/state/session.ts';

const base = newTable([{ id: 'a', name: 'Ada', score: 0 }, { id: 'b', name: 'Ben', score: 0 }]);
const snap = (revision: number, table: Partial<Table>): Snapshot => ({ table: { ...base, ...table }, roll: null, revision,
  room: null, playerId: 'a', online: [], connection: 'local', error: null });

it('names a bank, a Farkle and hot dice from consecutive snapshots', () => {
  const banked = moment(snap(4, { phase: 'kept', turnScore: 600 }), snap(5, { turn: 2, active: 1, players: [{ id: 'a', name: 'Ada', score: 600 }, base.players[1]!] }), null);
  expect(banked).toEqual({ kind: 'bank', key: 5, player: 'a', points: 600 });
  const farkle = moment(snap(6, { phase: 'rolling', turnScore: 350 }), snap(7, { phase: 'bust', turnScore: 0 }), banked);
  expect(farkle).toEqual({ kind: 'farkle', key: 7, player: 'a', points: 350 });
  const hot = moment(snap(8, { phase: 'choosing', remaining: [0, 1] }), snap(9, { phase: 'rolling', remaining: [0, 1, 2, 3, 4, 5], kept: [], turnScore: 1500 }), null);
  expect(hot?.kind).toBe('hot');
  expect(moment(snap(9, { phase: 'rolling' }), snap(10, { phase: 'choosing' }), hot)).toBe(hot);
  expect(moment(snap(0, {}), snap(1, { phase: 'bust' }), null)).toBeNull();
});
it('sends only a scoring selection with Bank or Roll', () => {
  const state = (selected: number[]): State => ({ snapshot: snap(3, { phase: 'choosing', dice: [{ id: 0, value: 1 }, { id: 1, value: 3 }, { id: 2, value: 5 }] }),
    selected, name: '', room: '', error: null, names: [], now: 0, playing: false, sound: false, hints: true, moment: null });
  expect(selection(state([2, 0]))).toEqual({ values: [1, 5], score: 150, keep: [0, 2] });
  expect(selection(state([1])).keep).toBeUndefined();
});
