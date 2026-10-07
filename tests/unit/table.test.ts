import { describe, expect, it } from 'vitest';
import { applyMove, newTable, resolveRoll, type Move, type Table } from '../../src/game/table.ts';
import type { Face } from '../../src/game/scoring.ts';
const initial = newTable([{ id: 'a', name: 'A', score: 0 }, { id: 'b', name: 'B', score: 0 }]);
const move = (table: Table, command: Move): Table => {
  const result = applyMove(table, table.players[table.active]?.id ?? '', command);
  if (!result.ok) throw new Error(result.error); return result.table;
};
const rolled = (table: Table, faces: Face[]) => resolveRoll(move(table, { type: 'Roll' }), table.remaining.map((id, i) => ({ id, value: faces[i] ?? 2 })));
describe('turn transitions', () => {
  it('rejects wrong turns, invalid selections, and banking below the entry score', () => {
    expect(applyMove(initial, 'b', { type: 'Roll' }).ok).toBe(false);
    const table = rolled(initial, [1, 2, 3, 4, 6, 2]);
    expect(applyMove(table, 'a', { type: 'Keep', ids: [0, 0] }).ok).toBe(false);
    expect(applyMove(table, 'a', { type: 'Keep', ids: [0, 1] }).ok).toBe(false);
    const kept = move(table, { type: 'Keep', ids: [0] });
    expect(applyMove(kept, 'a', { type: 'Bank' }).ok).toBe(false);
    expect(kept.remaining).toEqual([1, 2, 3, 4, 5]);
  });
  it('banks points once, advances the player, and resets turn points', () => {
    const table = rolled(initial, [1, 1, 1, 2, 3, 4]);
    const banked = move(move(table, { type: 'Keep', ids: [0, 1, 2] }), { type: 'Bank' });
    expect(banked.players[0]?.score).toBe(1000); expect(banked.turnScore).toBe(0); expect(banked.active).toBe(1);
    expect(applyMove(banked, 'a', { type: 'Bank' }).ok).toBe(false);
  });
  it('offers hot dice and never combines dice across rolls', () => {
    const table = move(rolled(initial, [1, 2, 3, 4, 5, 6]), { type: 'Keep', ids: [0, 1, 2, 3, 4, 5] });
    expect(table.remaining).toHaveLength(6); expect(table.turnScore).toBe(1500);
    const second = rolled(table, [1, 1, 2, 3, 4, 6]);
    expect(move(second, { type: 'Keep', ids: [0, 1] }).turnScore).toBe(1700);
  });
  it('loses all turn points on a bust and accepts no extra roll before next player', () => {
    const kept = move(rolled(initial, [1, 1, 1, 2, 3, 4]), { type: 'Keep', ids: [0, 1, 2] });
    const busted = rolled(kept, [2, 3, 4]);
    expect(busted.phase).toBe('bust'); expect(busted.turnScore).toBe(0);
    expect(applyMove(busted, 'a', { type: 'Roll' }).ok).toBe(false);
    expect(move(busted, { type: 'Next' }).active).toBe(1);
  });
  it('ignores stale or incomplete roll completions', () => {
    expect(resolveRoll(initial, [])).toBe(initial);
    const rolling = move(initial, { type: 'Roll' });
    expect(resolveRoll(rolling, [{ id: 0, value: 1 }])).toBe(rolling);
  });
});
