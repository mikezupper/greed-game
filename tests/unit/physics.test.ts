import { expect, it } from 'vitest';
import { simulate, MAX_STEPS } from '../../src/physics/simulate.ts';
import { readFace } from '../../src/physics/read-face.ts';

it('replays a physical roll exactly and bounds simulation work', async () => {
  const a = await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] });
  const b = await simulate({ seed: 42, ids: [0, 1, 2, 3, 4, 5] });
  expect(a).toEqual(b); expect(a.settled).toBe(true); expect(a.steps).toBeLessThanOrEqual(MAX_STEPS);
  expect(a.frames.at(-1)?.poses.map(p => readFace(p.rotation).value)).toEqual(a.dice.map(d => d.value));
});
it('keeps dice identity when rolling a nonconsecutive subset', async () => {
  const roll = await simulate({ seed: 51, ids: [1, 4, 5] });
  expect(roll.dice.map(d => d.id)).toEqual([1, 4, 5]); expect(roll.settled).toBe(true);
  await expect(simulate({ seed: 42, ids: [0, 0] })).rejects.toThrow('Invalid dice ids');
});
it('physically nudges a previously cocked throw without choosing a face', async () => {
  const roll = await simulate({ seed: 1407963097, ids: [0] });
  expect(roll.nudges).toBeGreaterThan(0); expect(roll.settled).toBe(true);
});
it.each([[4283564756, 4], [1803271355, 5], ...[3782970140, 1335271764, 3602705804, 3004631712, 132704674, 3316171314, 4248905315].map(seed => [seed, 6])])('settles the former failure seed %i through same-world recovery', async (seed, count) => {
  const roll = await simulate({ seed: seed ?? 0, ids: Array.from({ length: count ?? 6 }, (_, id) => id) });
  expect(roll.settled).toBe(true); expect(roll.frames.at(-1)?.poses.map(p => readFace(p.rotation).value)).toEqual(roll.dice.map(d => d.value));
});
