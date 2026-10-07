import { expect, it } from 'vitest';
import { BUST_CHANCE, scoringDice } from '../../src/game/odds.ts';
import { MoveSchema } from '../../src/protocol/messages.ts';

it('counts the documented Farkle chances through the scoring rules', () => {
  expect(BUST_CHANCE.map(p => Math.round(p * 100_000) / 1000)).toEqual([0, 66.667, 44.444, 27.778, 15.741, 7.716, 2.315]);
});
it('marks every die that can belong to a scoring selection', () => {
  const dice = (faces: (1 | 2 | 3 | 4 | 5 | 6)[]) => faces.map((value, id) => ({ id, value }));
  expect(scoringDice(dice([5, 3, 3, 3, 6]))).toEqual([0, 1, 2, 3]);
  expect(scoringDice(dice([2, 2, 3, 3, 6, 6]))).toEqual([0, 1, 2, 3, 4, 5]);
  expect(scoringDice(dice([2, 3, 4, 6]))).toEqual([]);
});
it('accepts a selection on Bank and Roll messages and rejects malformed ones', () => {
  expect(MoveSchema.safeParse({ type: 'Bank', keep: [0, 2] }).success).toBe(true);
  expect(MoveSchema.safeParse({ type: 'Roll' }).success).toBe(true);
  expect(MoveSchema.safeParse({ type: 'Roll', keep: [] }).success).toBe(false);
  expect(MoveSchema.safeParse({ type: 'Bank', keep: [1, 1] }).success).toBe(false);
});
