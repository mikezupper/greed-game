import { expect, it } from 'vitest';
import { applyMove, newMatch, resolveRoll, type Table, type Move } from '../../src/game/table.ts';
import { expireTurn } from '../../src/game/match.ts';
import { randomSource } from '../../src/physics/random.ts';
import { scoreSelection, type Face } from '../../src/game/scoring.ts';

const players = ['Ada', 'Ben', 'Cy'].map((name, i) => ({ id: String(i), name, score: 0 }));
function move(table: Table, m: Move): Table {
  const result = applyMove(table, table.players[table.active]?.id ?? '', m);
  if (!result.ok) throw new Error(result.error); return result.table;
}
function opening(table: Table, value: Face): Table { return resolveRoll(move(table, { type: 'Roll' }), [{ id: 0, value }]); }
const bank = (table: Table, score: number) => move({ ...table, phase: 'kept', turnScore: score }, { type: 'Bank' });
it('resolves an opening tie among leaders only and gives the winner the first turn', () => {
  let t = move(newMatch(players), { type: 'Start' });
  t = opening(opening(opening(t, 5), 5), 2);
  expect(t.match.queue).toEqual([0, 1]); expect(t.match.stage).toBe('opening');
  t = opening(opening(t, 3), 6);
  expect(t.active).toBe(1); expect(t.match.stage).toBe('playing'); expect(t.remaining).toHaveLength(6);
});
it('gives every other player exactly one final turn and waits until all turns end', () => {
  let t: Table = { ...newMatch(players, 1000), match: { ...newMatch(players, 1000).match, stage: 'playing' }, active: 1 };
  t = bank(t, 1000); expect(t.match.queue).toEqual([2, 0]);
  t = bank(t, 2000); expect(t.match.stage).toBe('final'); expect(t.match.winners).toEqual([]);
  t = bank(t, 1500); expect(t.match.stage).toBe('finished'); expect(t.match.winners).toEqual(['2']);
  expect(move(t, { type: 'Rematch' }).players.every(p => p.score === 0)).toBe(true);
});
it('compares sudden-death scores only after equal turns, and narrows repeated ties', () => {
  let t: Table = { ...newMatch(players, 1000), match: { ...newMatch(players, 1000).match, stage: 'playing' } };
  t = bank(bank(bank(t, 1000), 1000), 1000);
  expect(t.match.stage).toBe('tiebreak'); expect(t.match.queue).toEqual([0, 1, 2]);
  t = bank(t, 100); expect(t.match.stage).toBe('tiebreak');
  t = bank(t, 100); t = expireTurn(t); expect(t.match.queue).toEqual([0, 1]);
  t = bank(t, 50); t = expireTurn(t); expect(t.match.winners).toEqual(['0']);
});
it('timeout banks only committed legal points; otherwise forfeits the turn', () => {
  const t: Table = { ...newMatch(players), match: { ...newMatch(players).match, stage: 'playing' }, phase: 'choosing', turnScore: 450 };
  expect(expireTurn(t).players[0]?.score).toBe(0);
  expect(expireTurn({ ...t, turnScore: 500 }).players[0]?.score).toBe(500);
});
it('finishes seeded ten-thousand-point matches without breaking score/dice/queue invariants', () => {
  for (let seed = 0; seed < 20; seed++) {
    const random = randomSource(seed); let table = move(newMatch(players), { type: 'Start' });
    for (let n = 0; n < 5000 && table.match.stage !== 'finished'; n++) {
      if (table.phase === 'ready' || (table.phase === 'kept' && table.turnScore < 500)) {
        table = move(table, { type: 'Roll' }); table = resolveRoll(table, table.remaining.map(id => ({ id, value: (1 + Math.floor(random() * 6)) as Face })));
      } else if (table.phase === 'choosing') {
        let ids: number[] = [], best = -1;
        for (let mask = 1; mask < 1 << table.dice.length; mask++) {
          const selection = table.dice.filter((_, i) => mask & (1 << i)), score = scoreSelection(selection.map(d => d.value));
          if (score !== null && score > best) { best = score; ids = selection.map(d => d.id); }
        }
        table = move(table, { type: 'Keep', ids });
      } else table = move(table, { type: table.phase === 'bust' ? 'Next' : 'Bank' });
      expect(table.players.every(p => p.score >= 0 && p.score % 50 === 0)).toBe(true);
      expect(new Set(table.remaining).size).toBe(table.remaining.length);
      expect(new Set(table.match.queue).size).toBe(table.match.queue.length);
      expect(table.active).toBeLessThan(players.length);
    }
    expect(table.match.stage).toBe('finished'); expect(table.match.winners).toHaveLength(1);
  }
});
