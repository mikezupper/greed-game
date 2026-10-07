import { describe, expect, it } from 'vitest';
import { hasScore, scoreSelection, type Face } from '../../src/game/scoring.ts';

describe('supplied scoring rules', () => {
  it.each<[Face[], number | null]>([
    [[1], 100], [[5], 50], [[2], null], [[1, 2], null], [[], null],
    [[1, 1, 1], 1000], [[5, 5, 5], 500], [[6, 6, 6], 600],
    [[1, 1, 1, 1], 1000], [[1, 1, 1, 1, 1], 2000], [[1, 1, 1, 1, 1, 1], 3000],
    [[1, 2, 3, 4, 5, 6], 1500], [[2, 2, 4, 4, 6, 6], 1500], [[2, 2, 2, 5, 5, 5], 2500],
    [[2, 2, 2, 1, 5], 350], [[2, 2, 2, 4], null],
  ])('%j scores %s', (dice, score) => { expect(scoreSelection(dice)).toBe(score); expect(scoreSelection([...dice].reverse())).toBe(score); });
  it('distinguishes a scoring subset from an invalid selection', () => {
    expect(hasScore([1, 2, 3])).toBe(true); expect(scoreSelection([1, 2, 3])).toBeNull();
    expect(hasScore([2, 3, 4, 6])).toBe(false); expect(hasScore([2, 2, 4, 4, 6, 6])).toBe(true);
  });
  it('derives bust odds by exhaustive enumeration', () => {
    let busted = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      if (!hasScore([a, b, c] as Face[])) busted++;
    }
    expect(busted).toBe(60);
  });
});
