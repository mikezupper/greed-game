import { define, html } from '@gyral/core';
import { newMatch } from '../game/table.ts';
import { Name, RoomCode } from '../protocol/messages.ts';
import type { Snapshot } from '../state/session.ts';
import { act, watchTable, watchClock, type Action } from './drivers.ts';
import { bestSelection, busy, moment, owns, screenOf, selection, type Msg, type State } from './model.ts';
import { startScreen, waitingRoom } from './screens.ts';
import { tableScreen } from './table-view.ts';

export type { Msg, State } from './model.ts';
const initial: Snapshot = { table: newMatch([]), roll: null, revision: 0, room: null, playerId: null, online: [], connection: 'local', error: null };
const perform = (s: State, action: Action) => [s, [act(action, (message): Msg => ({ _tag: 'Failed', message }))]] as const;
const moving = (s: State, type: 'Next' | 'Start' | 'Rematch' | 'Leave' | 'Retry') => perform(s, { type: 'Move', move: { type } });
/** Bank and Roll carry the current selection, so keeping and deciding is one transition. */
const deciding = (s: State, type: 'Roll' | 'Bank') => {
  const keep = selection(s).keep;
  return perform(s, { type: 'Move', move: keep ? { type, keep } : { type } });
};
const seatIndex = (target: unknown): number | undefined => {
  const index = target instanceof HTMLInputElement || target instanceof HTMLButtonElement ? Number(target.name.replace('seat-', '') || target.value) : NaN;
  return Number.isInteger(index) && index >= 0 && index < 8 ? index : undefined;
};

export const GreedTable = define<State, Msg>('greed-table', {
  shadow: false,
  init: () => [{ snapshot: initial, selected: [], name: '', room: '', names: ['Player 1', 'Player 2'], error: null, now: 0,
    playing: false, sound: false, hints: true, moment: null },
  [watchTable((snapshot): Msg => ({ _tag: 'Changed', snapshot })), watchClock((now): Msg => ({ _tag: 'Tick', now }))]],
  intent: {
    Pick: ({ value, event }) => {
      const id = event instanceof CustomEvent ? Number(event.detail) : Number(value);
      return Number.isInteger(id) && id >= 0 && id <= 5 ? { _tag: 'Pick', id } : undefined;
    },
    Playback: ({ event }) => event instanceof CustomEvent ? { _tag: 'Playback', playing: event.detail === true } : undefined,
    Roll: () => ({ _tag: 'Roll' }), Bank: () => ({ _tag: 'Bank' }), Next: () => ({ _tag: 'Next' }),
    Name: ({ value }) => ({ _tag: 'Name', value: value ?? '' }), Room: ({ value }) => ({ _tag: 'Room', value: (value ?? '').toUpperCase() }),
    SeatName: ({ value, target }) => { const index = seatIndex(target); return index === undefined ? undefined : { _tag: 'SeatName', index, value: value ?? '' }; },
    AddSeat: () => ({ _tag: 'AddSeat' }),
    RemoveSeat: ({ value }) => { const index = Number(value); return Number.isInteger(index) ? { _tag: 'RemoveSeat', index } : undefined; },
    Create: () => ({ _tag: 'Create' }), Join: () => ({ _tag: 'Join' }), Local: () => ({ _tag: 'Local' }), NewTable: () => ({ _tag: 'NewTable' }),
    Copy: () => ({ _tag: 'Copy' }), StartLocal: () => ({ _tag: 'StartLocal' }),
    Start: () => ({ _tag: 'Start' }), Rematch: () => ({ _tag: 'Rematch' }), Ready: () => ({ _tag: 'Ready' }), Clock: () => ({ _tag: 'Clock' }),
    Leave: () => ({ _tag: 'Leave' }), Retry: () => ({ _tag: 'Retry' }), Suggest: () => ({ _tag: 'Suggest' }),
    Sound: () => ({ _tag: 'Sound' }), Hints: () => ({ _tag: 'Hints' }),
  },
  update: {
    Changed: (s, m) => ({ ...s, snapshot: m.snapshot, selected: m.snapshot.revision === s.snapshot.revision ? s.selected : [], error: null,
      name: s.name || m.snapshot.suggestedName || '', room: s.room || m.snapshot.invitation || '',
      moment: moment(s.snapshot, m.snapshot, s.moment),
      playing: m.snapshot.roll && m.snapshot.roll.seed !== s.snapshot.roll?.seed ? true : m.snapshot.roll === null ? false : s.playing }),
    Tick: (s, m) => ({ ...s, now: m.now }), Playback: (s, m) => ({ ...s, playing: m.playing }),
    Pick: (s, m) => !owns(s) || busy(s) || s.snapshot.table.phase !== 'choosing' || !s.snapshot.table.dice.some(d => d.id === m.id)
      ? s : { ...s, selected: s.selected.includes(m.id) ? s.selected.filter(id => id !== m.id) : [...s.selected, m.id] },
    Roll: s => deciding(s, 'Roll'), Bank: s => deciding(s, 'Bank'),
    Next: s => moving(s, 'Next'), Start: s => moving(s, 'Start'), Rematch: s => moving(s, 'Rematch'),
    Leave: s => moving(s, 'Leave'), Retry: s => moving(s, 'Retry'),
    Ready: s => perform(s, { type: 'Move', move: { type: 'Ready', ready: !(s.snapshot.lobby?.ready.includes(s.snapshot.playerId ?? '') ?? false) } }),
    Clock: s => perform(s, { type: 'Move', move: { type: 'Clock', enabled: !s.snapshot.lobby?.clockSeconds } }),
    Name: (s, m) => ({ ...s, name: m.value }), Room: (s, m) => ({ ...s, room: m.value }),
    SeatName: (s, m) => ({ ...s, names: s.names.map((name, index) => index === m.index ? m.value : name) }),
    AddSeat: s => s.names.length >= 8 ? s : { ...s, names: [...s.names, `Player ${s.names.length + 1}`] },
    RemoveSeat: (s, m) => s.names.length <= 2 ? s : { ...s, names: s.names.filter((_, index) => index !== m.index) },
    Create: s => Name.safeParse(s.name).success ? perform(s, { type: 'Create', name: s.name.trim() }) : { ...s, error: 'Enter your name first.' },
    Join: s => Name.safeParse(s.name).success && RoomCode.safeParse(s.room).success
      ? perform(s, { type: 'Join', name: s.name.trim(), room: s.room }) : { ...s, error: 'Enter your name and a six-character room code.' },
    Local: s => perform(s, { type: 'Local' }),
    NewTable: s => perform({ ...s, names: s.snapshot.connection === 'local' && s.snapshot.table.players.length >= 2 ? s.snapshot.table.players.map(p => p.name) : s.names },
      { type: 'Setup', names: s.snapshot.table.players.map(p => p.name), start: false }),
    StartLocal: s => perform(s, { type: 'Setup', names: s.names.map(name => name.trim()).filter(Boolean), start: true }),
    Copy: s => perform({ ...s, error: 'Invite link copied.' }, { type: 'Copy' }),
    Suggest: s => !owns(s) || busy(s) || s.snapshot.table.phase !== 'choosing' ? s : { ...s, selected: bestSelection(s.snapshot.table) },
    Sound: s => perform({ ...s, sound: !s.sound }, { type: 'Sound', enabled: !s.sound }),
    Hints: s => ({ ...s, hints: !s.hints }),
    Failed: (s, m) => ({ ...s, error: m.message }),
  },
  view: s => {
    const screen = screenOf(s.snapshot), table = s.snapshot.table;
    // Data attributes expose the visible table state to browser validation scripts.
    return html`<div class="screen" data-screen=${screen} data-stage=${table.match.stage} data-phase=${table.phase}
      data-active=${table.players[table.active]?.id ?? ''} data-viewer=${s.snapshot.playerId ?? ''} data-revision=${s.snapshot.revision}>
      ${screen === 'start' ? startScreen(s) : screen === 'waiting' ? waitingRoom(s) : tableScreen(s)}</div>`;
  },
});
