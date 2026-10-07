import { each, html, intents } from '@gyral/core';
import { emptyLobby } from '../protocol/messages.ts';
import type { Msg, State } from './model.ts';

const i = intents<Msg>();
const seatName = (seat: { readonly index: number; readonly name: string }, count: number) => html`
  <li><span class="seat-number" aria-hidden="true">${seat.index + 1}</span>
    <input type="text" name=${`seat-${seat.index}`} aria-label=${`Player ${seat.index + 1} name`} maxlength="24" autocomplete="off"
      value=${seat.name} data-intent=${i.SeatName} />
    <button type="button" class="icon" value=${seat.index} data-intent=${i.RemoveSeat} aria-label=${`Remove player ${seat.index + 1}`}
      ?disabled=${count <= 2}>✕</button></li>`;
const seatRow = (p: { readonly id: string; readonly name: string }, flags: { readonly host: boolean; readonly ready: boolean; readonly online: boolean; readonly you: boolean }) => html`
  <li><span><bdi>${p.name}</bdi>${flags.you ? ' (you)' : ''}${flags.host ? html` <small>Host</small>` : ''}</span>
    <span class=${`seat-state${flags.online && flags.ready ? ' ok' : ''}`}>${flags.online ? (flags.ready ? 'Ready' : 'Not ready') : 'Offline'}</span></li>`;

/** Before any match: pass-and-play seats beside online room creation and joining. */
export function startScreen(s: State) {
  const seats = s.names.map((name, index) => ({ index, name }));
  return html`<div class="start">
    <section class="choice" aria-labelledby="local-heading">
      <h2 id="local-heading">Play at this table</h2>
      <p>Pass one screen around the room. Two to eight players. Local matches save in this browser.</p>
      <ol class="seat-names">${each(seats, seat => seat.index, seatName, () => seats.length)}</ol>
      <div class="row"><button type="button" data-intent=${i.AddSeat} ?disabled=${seats.length >= 8}>Add player</button>
        <button type="button" class="go" data-intent=${i.StartLocal}>Start game</button></div>
    </section>
    <section class="choice" aria-labelledby="online-heading">
      <h2 id="online-heading">Play with friends online</h2>
      <p>Open a private room and send the invite link. Everyone joins as a guest.</p>
      <div class="row"><label class="field">Your name <input name="player-name" autocomplete="nickname" maxlength="24" value=${s.name} data-intent=${i.Name} /></label>
        <button type="button" class="go" data-intent=${i.Create}>Create room</button></div>
      <p class="or">or join a friend</p>
      <div class="row"><label class="field">Room code <input name="room-code" maxlength="6" value=${s.room} data-intent=${i.Room} autocapitalize="characters" spellcheck="false" /></label>
        <button type="button" data-intent=${i.Join}>Join room</button></div>
    </section>
    ${s.error || s.snapshot.error ? html`<p role="alert">${s.error ?? s.snapshot.error}</p>` : ''}
  </div>`;
}

/** Online lobby: share the room, seat everyone, ready up, and let the host start. */
export function waitingRoom(s: State) {
  const { table, connection, playerId, room, online } = s.snapshot, lobby = s.snapshot.lobby ?? emptyLobby();
  const host = lobby.host !== null && lobby.host === playerId, seated = playerId !== null && connection === 'online';
  const ready = playerId !== null && lobby.ready.includes(playerId);
  const canStart = table.players.length >= 2 && table.players.every(p => lobby.ready.includes(p.id) && online.includes(p.id));
  return html`<section class="waiting" aria-labelledby="room-heading">
    <p class="eyebrow">Private room</p>
    <h2 id="room-heading">Room <code class="room-code">${room ?? '······'}</code></h2>
    <p role="status">${connectionLabel(s)}${playerId === null && connection === 'online' ? ' · Spectating' : ''}</p>
    <div class="row">${room ? html`<button type="button" data-intent=${i.Copy}>Copy invite link</button>` : ''}
      ${seated ? html`<button type="button" data-intent=${i.Leave}>Leave room</button>` : html`<button type="button" data-intent=${i.Local}>Back to start</button>`}</div>
    <h3>Before the first roll</h3>
    <ul class="seats">${each(table.players, p => p.id, seatRow, p => ({ host: p.id === lobby.host, ready: lobby.ready.includes(p.id),
      online: online.includes(p.id), you: p.id === playerId }))}</ul>
    <p class="muted">Two to eight players. Everyone rolls one die; the highest starts.</p>
    <menu class="row">${seated ? html`<li><button type="button" class=${ready ? '' : 'go'} data-intent=${i.Ready}>${ready ? 'Not ready' : 'Ready to play'}</button></li>` : ''}
      ${host ? html`<li><button type="button" class="go" data-intent=${i.Start} ?disabled=${!canStart}>Start game</button></li>
        <li><button type="button" data-intent=${i.Clock} aria-pressed=${String(lobby.clockSeconds > 0)}>60-second clock ${lobby.clockSeconds ? 'on' : 'off'}</button></li>` : ''}</menu>
    ${!canStart ? html`<p class="muted">${host ? 'Start unlocks when everyone is connected and ready.' : 'The host starts once everyone is ready.'}</p>` : ''}
    ${s.error || s.snapshot.error ? html`<p role="alert">${s.error ?? s.snapshot.error}</p>` : ''}
  </section>`;
}

export function connectionLabel(s: State): string {
  const { connection, online } = s.snapshot;
  const label = { local: 'Pass and play', connecting: 'Connecting…', online: 'Online', reconnecting: 'Reconnecting…', closed: 'Disconnected' }[connection];
  return connection === 'local' ? label : `${label} · ${online.length} connected`;
}
