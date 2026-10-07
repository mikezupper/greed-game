import { afterEach, expect, it } from 'vitest';
import { settled } from '@gyral/core';
import { fakeDriver, step } from '@gyral/testing';
import { GreedTable } from '../../src/app/greed-table.ts';
import { newTable } from '../../src/game/table.ts';
import type { Snapshot } from '../../src/state/session.ts';

afterEach(() => document.body.replaceChildren());
it('renders semantic controls, selects dice, and emits a keep command', async () => {
  const watch = fakeDriver('table-watch'), action = fakeDriver('table-action'), clock = fakeDriver('table-clock');
  const element = new GreedTable(); element.drivers = { 'table-watch': watch, 'table-action': action, 'table-clock': clock }; document.body.append(element);
  await settled();
  const snapshot: Snapshot = { table: { ...newTable([{ id: 'a', name: 'Ada', score: 0 }, { id: 'b', name: 'Ben', score: 0 }]),
    phase: 'choosing', dice: [{ id: 0, value: 1 }, { id: 1, value: 5 }] },
    roll: null, revision: 1, room: null, playerId: 'a', online: [], connection: 'local', error: null };
  watch.emitNext(snapshot); await settled();
  element.querySelector<HTMLButtonElement>('[aria-label="Die 1: 1"]')?.click(); await settled();
  expect(element.querySelector('[aria-label="Die 1: 1"]')?.getAttribute('aria-pressed')).toBe('true');
  const keep = [...element.querySelectorAll('button')].find(b => b.textContent?.includes('Keep 100'));
  expect(keep?.disabled).toBe(false); keep?.click(); await settled();
  expect(action.inputs).toContainEqual({ type: 'Move', move: { type: 'Keep', ids: [0] } });
  element.remove(); expect(watch.calls[0]?.signal.aborted).toBe(true);
});
it('describes room creation as an effect and validates names before issuing it', () => {
  const initial = { snapshot: { table: newTable([]), roll: null, revision: 0, room: null, playerId: null, online: [], connection: 'local' as const, error: null },
    selected: [], name: '', room: '', error: null, names: 'Ada\nBen', now: 0, playing: false, sound: false };
  expect(step(GreedTable.spec, initial, { _tag: 'Create' }).state.error).toBe('Enter your name first.');
  expect(step(GreedTable.spec, { ...initial, name: 'Ada' }, { _tag: 'Create' }).commands).toHaveLength(1);
});
