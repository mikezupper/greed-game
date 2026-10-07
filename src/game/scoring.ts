export type Face = 1 | 2 | 3 | 4 | 5 | 6;
export const FACES: readonly Face[] = [1, 2, 3, 4, 5, 6];

/** All selected dice must score. Exact-kind values follow the supplied table. */
export function scoreSelection(dice: readonly Face[]): number | null {
  if (dice.length === 0 || dice.length > 6) return null;
  const counts = FACES.map(face => dice.filter(d => d === face).length);
  const groups = counts.filter(n => n > 0).sort((a, b) => a - b);
  if (dice.length === 6) {
    if (groups.length === 6 || groups.join(',') === '2,2,2') return POINTS.straightOrPairs;
    if (groups.join(',') === '3,3') return POINTS.twoTriplets;
  }
  let score = 0;
  for (const face of FACES) {
    const n = counts[face - 1] ?? 0;
    if (n >= 4) score += n === 4 ? POINTS.four : n === 5 ? POINTS.fiveKind : POINTS.six;
    else if (n === 3) score += face === 1 ? POINTS.tripleOne : face * POINTS.one;
    else if (face === 1 || face === 5) score += n * (face === 1 ? POINTS.one : POINTS.five);
    else if (n > 0) return null;
  }
  return score;
}

export function hasScore(dice: readonly Face[]): boolean {
  return dice.some(d => d === 1 || d === 5 || dice.filter(v => v === d).length >= 3)
    || (dice.length === 6 && scoreSelection(dice) !== null);
}
import { POINTS } from './rules.ts';
