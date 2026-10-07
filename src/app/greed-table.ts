import { define, each, html, intents } from '@gyral/core';
import { newMatch } from '../game/table.ts';
import { scoreSelection } from '../game/scoring.ts';
import { canBank } from '../game/match.ts';
import { emptyLobby, Name, RoomCode } from '../protocol/messages.ts';
import type { Snapshot } from '../state/session.ts';
import { act, watchTable, watchClock, type Action } from './drivers.ts';
import { dieRow, roomPanel, scorePanel } from './panels.ts';

export interface State {
  readonly snapshot: Snapshot; readonly selected: readonly number[]; readonly name: string; readonly room: string;
  readonly error: string | null; readonly names: string; readonly now: number; readonly playing: boolean; readonly sound: boolean;
}
export type Msg = { readonly _tag: 'Changed'; readonly snapshot: Snapshot } | { readonly _tag: 'Pick'; readonly id: number }
  | { readonly _tag: 'Roll' } | { readonly _tag: 'Keep' } | { readonly _tag: 'Bank' } | { readonly _tag: 'Next' }
  | { readonly _tag: 'Name'; readonly value: string } | { readonly _tag: 'Room'; readonly value: string } | { readonly _tag: 'Names'; readonly value: string }
  | { readonly _tag: 'Create' } | { readonly _tag: 'Join' } | { readonly _tag: 'Local' } | { readonly _tag: 'Copy' }
  | { readonly _tag: 'Start' } | { readonly _tag: 'Rematch' } | { readonly _tag: 'Ready' } | { readonly _tag: 'Clock' }
  | { readonly _tag: 'Leave' } | { readonly _tag: 'Retry' } | { readonly _tag: 'Setup' } | { readonly _tag: 'Suggest' } | { readonly _tag: 'Sound' }
  | { readonly _tag: 'Playback'; readonly playing: boolean } | { readonly _tag: 'Tick'; readonly now: number }
  | { readonly _tag: 'Failed'; readonly message: string };
const i = intents<Msg>();
const initial: Snapshot = { table: newMatch([]), roll: null, revision: 0, room: null, playerId: null, online: [], connection: 'local', error: null };
const perform = (s: State, action: Action) => [s, [act(action, (message): Msg => ({ _tag: 'Failed', message }))]] as const;
const moving = (s: State, type: 'Roll' | 'Bank' | 'Next' | 'Start' | 'Rematch' | 'Leave' | 'Retry') => perform(s, { type: 'Move', move: { type } });
const owns = (s: State) => s.snapshot.connection === 'local' || (s.snapshot.connection === 'online' && s.snapshot.table.players[s.snapshot.table.active]?.id === s.snapshot.playerId);
const busy = (s: State) => s.playing || s.now + (s.snapshot.clockOffset ?? 0) < (s.snapshot.lobby?.playbackUntil ?? 0);
function suggest(s: State): State {
  if (!owns(s) || busy(s) || s.snapshot.table.phase !== 'choosing') return s;
  const dice = s.snapshot.table.dice;
  let selected: number[] = [], best = -1;
  for (let mask = 1; mask < 1 << dice.length; mask++) {
    const subset = dice.filter((_, index) => mask & (1 << index)), score = scoreSelection(subset.map(d => d.value));
    if (score !== null && score >= best) { best = score; selected = subset.map(d => d.id); }
  }
  return { ...s, selected };
}
export const GreedTable = define<State, Msg>('greed-table', {
  shadow: false,
  init: () => [{ snapshot: initial, selected: [], name: '', room: '', names: 'Player 1\nPlayer 2', error: null, now: 0, playing: false, sound: false },
    [watchTable((snapshot): Msg => ({ _tag: 'Changed', snapshot })), watchClock((now): Msg => ({ _tag: 'Tick', now }))]],
  intent: {
    Pick: ({ value, event }) => {
      const id = event instanceof CustomEvent ? Number(event.detail) : Number(value);
      return Number.isInteger(id) && id >= 0 && id <= 5 ? { _tag: 'Pick', id } : undefined;
    },
    Playback: ({ event }) => event instanceof CustomEvent ? { _tag: 'Playback', playing: event.detail === true } : undefined,
    Roll: () => ({ _tag: 'Roll' }), Keep: () => ({ _tag: 'Keep' }), Bank: () => ({ _tag: 'Bank' }), Next: () => ({ _tag: 'Next' }),
    Name: ({ value }) => ({ _tag: 'Name', value: value ?? '' }), Room: ({ value }) => ({ _tag: 'Room', value: (value ?? '').toUpperCase() }),
    Names: ({ value }) => ({ _tag: 'Names', value: value ?? '' }),
    Create: () => ({ _tag: 'Create' }), Join: () => ({ _tag: 'Join' }), Local: () => ({ _tag: 'Local' }), Copy: () => ({ _tag: 'Copy' }),
    Start: () => ({ _tag: 'Start' }), Rematch: () => ({ _tag: 'Rematch' }), Ready: () => ({ _tag: 'Ready' }), Clock: () => ({ _tag: 'Clock' }),
    Leave: () => ({ _tag: 'Leave' }), Retry: () => ({ _tag: 'Retry' }), Setup: () => ({ _tag: 'Setup' }), Suggest: () => ({ _tag: 'Suggest' }), Sound: () => ({ _tag: 'Sound' }),
  },
  update: {
    Changed: (s, m) => ({ ...s, snapshot: m.snapshot, selected: m.snapshot.revision === s.snapshot.revision ? s.selected : [], error: null,
      name: s.name || m.snapshot.suggestedName || '', room: s.room || m.snapshot.invitation || '',
      playing: m.snapshot.roll && m.snapshot.roll.seed !== s.snapshot.roll?.seed ? true : m.snapshot.roll === null ? false : s.playing }),
    Tick: (s, m) => ({ ...s, now: m.now }), Playback: (s, m) => ({ ...s, playing: m.playing }),
    Pick: (s, m) => !owns(s) || busy(s) || s.snapshot.table.phase !== 'choosing' || !s.snapshot.table.dice.some(d => d.id === m.id)
      ? s : { ...s, selected: s.selected.includes(m.id) ? s.selected.filter(id => id !== m.id) : [...s.selected, m.id] },
    Roll: s => moving(s, 'Roll'), Keep: s => perform(s, { type: 'Move', move: { type: 'Keep', ids: s.selected } }),
    Bank: s => moving(s, 'Bank'), Next: s => moving(s, 'Next'), Start: s => moving(s, 'Start'), Rematch: s => moving(s, 'Rematch'),
    Leave: s => moving(s, 'Leave'), Retry: s => moving(s, 'Retry'),
    Ready: s => perform(s, { type: 'Move', move: { type: 'Ready', ready: !(s.snapshot.lobby?.ready.includes(s.snapshot.playerId ?? '') ?? false) } }),
    Clock: s => perform(s, { type: 'Move', move: { type: 'Clock', enabled: !s.snapshot.lobby?.clockSeconds } }),
    Name: (s, m) => ({ ...s, name: m.value }), Room: (s, m) => ({ ...s, room: m.value }), Names: (s, m) => ({ ...s, names: m.value }),
    Create: s => Name.safeParse(s.name).success ? perform(s, { type: 'Create', name: s.name.trim() }) : { ...s, error: 'Enter your name first.' },
    Join: s => Name.safeParse(s.name).success && RoomCode.safeParse(s.room).success
      ? perform(s, { type: 'Join', name: s.name.trim(), room: s.room }) : { ...s, error: 'Enter your name and a six-character room code.' },
    Local: s => perform(s, { type: 'Local' }), Setup: s => perform(s, { type: 'Setup', names: s.names.split('\n').map(name => name.trim()).filter(Boolean) }),
    Copy: s => perform({ ...s, error: 'Invite link copied.' }, { type: 'Copy' }), Suggest: suggest,
    Sound: s => perform({ ...s, sound: !s.sound }, { type: 'Sound', enabled: !s.sound }), Failed: (s, m) => ({ ...s, error: m.message }),
  },
  view: s => {
    const { table, connection, playerId } = s.snapshot, lobby = s.snapshot.lobby ?? emptyLobby();
    const own = owns(s), locked = busy(s), stage = table.match.stage;
    const playable = !['lobby', 'finished'].includes(stage), opening = stage === 'opening';
    const selectedScore = scoreSelection(table.dice.filter(d => s.selected.includes(d.id)).map(d => d.value));
    const host = connection === 'local' || lobby.host === playerId;
    const seconds = lobby.deadline === null ? null : Math.max(0, Math.ceil((lobby.deadline - s.now - (s.snapshot.clockOffset ?? 0)) / 1000));
    return html`${roomPanel(s)}<div class="table-layout" data-stage=${stage} data-phase=${table.phase}
      data-active=${table.players[table.active]?.id ?? ''} data-viewer=${playerId ?? ''} data-revision=${s.snapshot.revision}>
      <section class="play-area" aria-labelledby="turn-heading">
      <header class="turn-header"><h2 id="turn-heading">${stage === 'finished' ? 'Match complete' : stage === 'lobby' ? 'Your table' : table.players[table.active]?.name ?? 'Waiting for players'}
        <small>${opening ? 'Opening roll' : `Turn ${table.turn}`}</small></h2><p>At stake <output class="turn-score">${table.turnScore}</output></p></header>
      <figure class="tray-frame" data-intent=${i.Playback} data-intent-on="dice-playback">
        <dice-tray .snapshot=${{ roll: s.snapshot.roll, kept: table.kept, selected: s.selected }} data-intent=${i.Pick} data-intent-on="dice-pick"></dice-tray>
        <figcaption>${playable && !opening ? 'Pick dice in the tray or use the buttons below.' : 'Six dice. One table.'}</figcaption>
      </figure>
      <p class="turn-notice" role="status" aria-atomic="true">${locked ? 'Watch the dice. Your controls unlock when playback ends.' : table.notice}</p>
      ${seconds !== null ? html`<p class="clock" role="timer" aria-label="Decision time remaining">${seconds} seconds to decide</p>` : ''}
      ${connection === 'reconnecting' ? html`<p role="status">Reconnecting. Your seat is saved; the table allows 30 seconds before passing your turn.</p>` : ''}
      ${playable && !opening ? html`<fieldset class="dice-picker"><legend>Dice from this roll</legend><ul>${each(table.dice, d => d.id, dieRow,
        d => ({ selected: s.selected.includes(d.id), disabled: !own || locked || table.phase !== 'choosing' }))}</ul>
        ${table.phase === 'choosing' ? html`<button type="button" data-intent=${i.Suggest} ?disabled=${!own || locked}>Select scoring dice</button>
          <p class="selection-help">${s.selected.length && selectedScore === null ? 'This selection includes dice that do not score. Choose single 1s or 5s, or a whole combination.' : `${s.selected.length} selected · ${selectedScore ?? 0} points`}</p>` : ''}</fieldset>` : ''}
      ${playable ? html`<menu class="actions">
        <li><button type="button" class="primary" data-intent=${i.Roll} ?disabled=${!own || locked || (table.phase !== 'ready' && table.phase !== 'kept')}>Roll ${table.remaining.length} ${table.remaining.length === 1 ? 'die' : 'dice'}</button></li>
        ${!opening ? html`<li><button type="button" data-intent=${i.Keep} ?disabled=${!own || locked || table.phase !== 'choosing' || selectedScore === null}>Keep ${selectedScore ?? 0} points</button></li>
          <li><button type="button" data-intent=${i.Bank} ?disabled=${!own || locked || table.phase !== 'kept' || !canBank(table)}>Bank ${table.turnScore}</button></li>` : ''}
        ${table.phase === 'bust' ? html`<li><button type="button" data-intent=${i.Next} ?disabled=${!own || locked}>Next player</button></li>` : ''}
      </menu>` : ''}
      ${lobby.paused ? html`<section aria-label="Saved roll recovery"><p>The launch is saved. Retrying uses the same seed.</p>
        <button type="button" data-intent=${i.Retry} ?disabled=${!own}>Retry saved roll</button></section>` : ''}
      ${(stage === 'finished' || lobby.paused) && host ? html`<button type="button" class="primary" data-intent=${i.Rematch}>${lobby.paused ? 'Reset stalled match' : 'Play again'}</button>` : ''}
      ${stage === 'finished' && !host ? html`<p>Waiting for the host to open a rematch.</p>` : ''}
      ${table.kept.length ? html`<p class="held-dice">Kept dice: ${table.kept.map(d => d.value).join(', ')}</p>` : ''}
      ${playable && !opening && (table.players[table.active]?.score ?? 0) === 0 ? html`<p>Entry: ${Math.max(0, 500 - table.turnScore)} more points needed before banking.</p>` : ''}
      <button type="button" class="sound" data-intent=${i.Sound} aria-pressed=${String(s.sound)}>Sound ${s.sound ? 'on' : 'off'}</button>
      ${s.error || s.snapshot.error ? html`<p role="alert">${s.error ?? s.snapshot.error}</p>` : ''}
    </section>${scorePanel(s)}</div>`;
  },
});
