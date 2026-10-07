import { command, defineDriver, provideDrivers, subscription, type Command } from '@gyral/core';
import type { Move } from '../game/table.ts';
import type { Snapshot } from '../state/session.ts';
import type { Controller } from '../state/controller.ts';

export type Action = { readonly type: 'Move'; readonly move: Move } | { readonly type: 'Create'; readonly name: string }
  | { readonly type: 'Join'; readonly name: string; readonly room: string } | { readonly type: 'Local' } | { readonly type: 'Copy' }
  | { readonly type: 'Setup'; readonly names: readonly string[]; readonly start: boolean } | { readonly type: 'Sound'; readonly enabled: boolean };
const watch = subscription<Snapshot>('table-watch', () => { throw new Error('Provide a session controller.'); });
const clock = subscription<number>('table-clock', emit => { emit(Date.now()); const timer = setInterval(() => emit(Date.now()), 250); return () => clearInterval(timer); });
const action = defineDriver<Action, void, string>({ name: 'table-action', run: () => { throw new Error('Provide a session controller.'); }, toError: e => e instanceof Error ? e.message : String(e) });
export const watchTable = <M>(toMessage: (snapshot: Snapshot) => M): Command<M> => command(watch, undefined, { onSuccess: toMessage });
export const watchClock = <M>(toMessage: (now: number) => M): Command<M> => command(clock, undefined, { onSuccess: toMessage });
export const act = <M>(input: Action, onFailure: (message: string) => M): Command<M> => command<Action, void, string, M>(action, input, { concurrency: 'exhaust', onSuccess: () => undefined, onFailure });
export function provideController(element: Element, controller: Controller): () => void {
  return provideDrivers(element, {
    'table-watch': subscription<Snapshot>('table-watch', emit => controller.subscribe(emit)),
    'table-action': defineDriver<Action, void, string>({
      name: 'table-action', toError: e => e instanceof Error ? e.message : String(e),
      run: async input => {
        if (input.type === 'Move') controller.dispatch(input.move);
        else if (input.type === 'Create') await controller.create(input.name);
        else if (input.type === 'Join') controller.join(input.room, input.name);
        else if (input.type === 'Local') controller.local();
        else if (input.type === 'Setup') { controller.setup(input.names); if (input.start) controller.dispatch({ type: 'Start' }); }
        else if (input.type === 'Sound') document.dispatchEvent(new CustomEvent('greed-sound', { detail: input.enabled }));
        else await navigator.clipboard.writeText(location.href);
      },
    }),
  });
}
