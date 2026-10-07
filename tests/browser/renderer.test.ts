import { afterEach, expect, it, vi } from 'vitest';
import { DiceTray, type TrayView } from '../../src/rendering/dice-tray.ts';
import { readFace } from '../../src/physics/read-face.ts';

afterEach(() => document.body.replaceChildren());
it('upgrades an early snapshot, plays its poses, and recreates a detached tray', async () => {
  const view: TrayView = { kept: [], selected: [], roll: {
    seed: 42, engine: 'fixture', dt: 1 / 60, steps: 3, settled: true, nudges: 0, dice: [{ id: 0, value: 1 }],
    frames: [
      { step: 0, poses: [{ id: 0, position: { x: 0, y: 3, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }] },
      { step: 3, poses: [{ id: 0, position: { x: 1, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }] },
    ],
  } };
  const tray = document.createElement('deferred-dice-tray') as DiceTray;
  tray.style.cssText = 'display:block;width:500px;height:300px';
  tray.snapshot = view; document.body.append(tray);
  customElements.define('deferred-dice-tray', class extends DiceTray {});
  await vi.waitFor(() => expect(tray.dataset['settled']).toBe('true'));
  expect(Object.hasOwn(tray, 'snapshot')).toBe(false);
  expect(tray.querySelectorAll('canvas')).toHaveLength(1);
  const poses = JSON.parse(tray.dataset['poses'] ?? '[]') as { id: number; position: number[] }[];
  expect(poses.find(p => p.id === 0)?.position).toEqual([1, 0.5, 0]);
  tray.remove(); expect(tray.querySelector('canvas')).toBeNull();
  document.body.append(tray);
  expect(tray.querySelectorAll('canvas')).toHaveLength(1);
  expect(tray.dataset['poses']).toBe(JSON.stringify(poses));
});
it('reconstructs held faces and untouched dice identically after a partial-roll reload', async () => {
  const view: TrayView = { kept: [{ id: 0, value: 6 }], selected: [], roll: {
    seed: 101, engine: 'fixture', dt: 1 / 60, steps: 0, settled: true, nudges: 0, dice: [{ id: 1, value: 1 }],
    frames: [{ step: 0, poses: [{ id: 1, position: { x: 2, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }] }],
  } };
  const a = new DiceTray(), b = new DiceTray();
  for (const tray of [a, b]) { tray.style.cssText = 'display:block;width:500px;height:300px'; document.body.append(tray); }
  a.snapshot = { ...view, roll: { ...view.roll!, seed: 100, dice: [{ id: 5, value: 1 }], frames: [{ step: 0, poses: [{ id: 5, position: { x: 4, y: 0.5, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }] }] } };
  a.snapshot = view; b.snapshot = view;
  expect(a.dataset['poses']).toBe(b.dataset['poses']);
  const poses = JSON.parse(a.dataset['poses'] ?? '[]') as { id: number; position: number[]; rotation: number[] }[];
  const held = poses.find(p => p.id === 0); expect(Math.abs(held?.position[2] ?? 0)).toBeGreaterThan(3.5);
  const [x = 0, y = 0, z = 0, w = 1] = held?.rotation ?? [];
  expect(readFace({ x, y, z, w }).value).toBe(6);
  for (let cycle = 0; cycle < 10; cycle++) { a.remove(); document.body.append(a); expect(a.querySelectorAll('canvas')).toHaveLength(1); }
});
it('places real buttons over choosable dice and reports picks', async () => {
  const tray = new DiceTray(); tray.style.cssText = 'display:block;width:480px;height:330px;position:relative';
  document.body.append(tray);
  const roll = { seed: 7, engine: 'fixture', dt: 1 / 60, steps: 0, settled: true, nudges: 0, dice: [{ id: 0, value: 5 as const }, { id: 1, value: 2 as const }],
    frames: [{ step: 0, poses: [{ id: 0, position: { x: -2, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }, { id: 1, position: { x: 2, y: 0.5, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }] }] };
  tray.snapshot = { roll, kept: [], selected: [0], dice: roll.dice, enabled: true, hints: [0] };
  const visible = () => [...tray.querySelectorAll<HTMLButtonElement>('.die-button')].filter(b => !b.hidden);
  await vi.waitFor(() => expect(visible()).toHaveLength(2));
  expect(visible().map(b => b.textContent)).toEqual(['Die showing 5', 'Die showing 2']);
  expect(visible()[0]?.getAttribute('aria-pressed')).toBe('true');
  const picks: unknown[] = []; tray.addEventListener('dice-pick', event => picks.push((event as CustomEvent).detail));
  visible()[1]?.click(); expect(picks).toEqual([1]);
  tray.snapshot = { roll, kept: [], selected: [], dice: roll.dice, enabled: false };
  expect(visible().every(b => b.disabled)).toBe(true);
});
