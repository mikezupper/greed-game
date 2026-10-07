import { afterEach, expect, it } from 'vitest';
import { settled } from '@gyral/core';
import { fakeDriver, step } from '@gyral/testing';
import { GreedTable } from '../../src/app/greed-table.ts';
import { newTable } from '../../src/game/table.ts';
import type { Snapshot } from '../../src/state/session.ts';

afterEach(() => document.body.replaceChildren());
it('selects dice from the tray and sends them with the roll', async () => {
  const watch = fakeDriver('table-watch'), action = fakeDriver('table-action'), clock = fakeDriver('table-clock');
  const element = new GreedTable(); element.drivers = { 'table-watch': watch, 'table-action': action, 'table-clock': clock }; document.body.append(element);
  await settled();
  const snapshot: Snapshot = { table: { ...newTable([{ id: 'a', name: 'Ada', score: 0 }, { id: 'b', name: 'Ben', score: 0 }]),
    phase: 'choosing', dice: [{ id: 0, value: 1 }, { id: 1, value: 5 }] },
    roll: null, revision: 1, room: null, playerId: 'a', online: [], connection: 'local', error: null };
  watch.emitNext(snapshot); await settled();
  element.querySelector('dice-tray')?.dispatchEvent(new CustomEvent('dice-pick', { detail: 0, bubbles: true })); await settled();
  const button = (text: string) => [...element.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(text));
  expect(element.querySelector('.preview')?.textContent).toContain('+100');
  expect(button('Bank 100')?.disabled).toBe(true);
  expect(button('Bank 100')?.textContent).toContain('Need 500 to get on the board');
  const roll = button('Roll 1 die');
  expect(roll?.disabled).toBe(false); expect(roll?.textContent).toContain('67% Farkle risk');
  roll?.click(); await settled();
  expect(action.inputs).toContainEqual({ type: 'Move', move: { type: 'Roll', keep: [0] } });
  element.remove(); expect(watch.calls[0]?.signal.aborted).toBe(true);
});
it('describes room creation as an effect and validates names before issuing it', () => {
  const initial = { snapshot: { table: newTable([]), roll: null, revision: 0, room: null, playerId: null, online: [], connection: 'local' as const, error: null },
    selected: [], name: '', room: '', error: null, names: ['Ada', 'Ben'], now: 0, playing: false, sound: false, hints: true, moment: null };
  expect(step(GreedTable.spec, initial, { _tag: 'Create' }).state.error).toBe('Enter your name first.');
  expect(step(GreedTable.spec, { ...initial, name: 'Ada' }, { _tag: 'Create' }).commands).toHaveLength(1);
});
