import { FACES, hasScore, scoreSelection, type Face } from './scoring.ts';

/** Exact Farkle chance for 0–6 fair dice, counted through the scoring rules themselves. */
export const BUST_CHANCE: readonly number[] = [0, 1, 2, 3, 4, 5, 6].map(count => {
  if (count === 0) return 0;
  let busts = 0;
  const visit = (dice: Face[]): void => {
    if (dice.length === count) { if (!hasScore(dice)) busts++; return; }
    for (const face of FACES) visit([...dice, face]);
  };
  visit([]);
  return busts / 6 ** count;
});

/** Dice in this roll that belong to at least one legal scoring selection. */
export function scoringDice(dice: readonly { readonly id: number; readonly value: Face }[]): readonly number[] {
  if (dice.length === 6 && scoreSelection(dice.map(d => d.value)) !== null) return dice.map(d => d.id);
  return dice.filter(d => d.value === 1 || d.value === 5 || dice.filter(o => o.value === d.value).length >= 3).map(d => d.id);
}
