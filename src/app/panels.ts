import { each, html, intents } from '@gyral/core';
import type { Msg, State } from './greed-table.ts';
import { emptyLobby } from '../protocol/messages.ts';
const i = intents<Msg>();
const seatRow = (p: { readonly id: string; readonly name: string }, flags: { readonly host: boolean; readonly ready: boolean; readonly online: boolean }) => html`
  <li><bdi>${p.name}</bdi> ${flags.host ? '· Host' : ''} <small>${flags.online ? (flags.ready ? 'Ready' : 'Not ready') : 'Offline'}</small></li>`;
const scoreRow = (p: { readonly id: string; readonly name: string; readonly score: number }, flags: { readonly active: boolean; readonly winner: boolean }) => html`
  <tr aria-current=${flags.active ? 'true' : 'false'}><th scope="row"><bdi>${p.name}</bdi>${flags.winner ? html`<small> · Winner</small>` : flags.active ? html`<small> · Playing</small>` : ''}</th><td>${p.score.toLocaleString('en-US')}</td></tr>`;
export const dieRow = (die: { readonly id: number; readonly value: number }, flags: { readonly selected: boolean; readonly disabled: boolean }) => html`
  <li><button type="button" class="die-button" value=${die.id} data-intent=${i.Pick} aria-pressed=${String(flags.selected)}
    ?disabled=${flags.disabled} aria-label=${`Die ${die.id + 1}: ${die.value}`}><strong>${die.value}</strong><small>Die ${die.id + 1}</small></button></li>`;
export function roomPanel(s: State) {
  const { table, connection, playerId, room } = s.snapshot, lobby = s.snapshot.lobby ?? emptyLobby();
  const local = connection === 'local', host = local || lobby.host === playerId, seated = playerId !== null && connection === 'online';
  const ready = playerId !== null && lobby.ready.includes(playerId), waiting = table.match.stage === 'lobby';
  const canStart = local || (table.players.length >= 2 && table.players.every(p => lobby.ready.includes(p.id) && s.snapshot.online.includes(p.id)));
  return html`<section class="room-bar" aria-labelledby="room-heading">
    <h2 id="room-heading">${room ? html`Room <code>${room}</code>` : 'Gather around the table'}</h2>
    ${room ? html`<p role="status">${connection}${playerId === null ? ' · Spectating' : ''} · ${s.snapshot.online.length} connected</p>
      <menu><li><button type="button" data-intent=${i.Copy}>Copy invite link</button></li>
        <li><button type="button" data-intent=${i.Local}>Local table</button></li>
        ${seated ? html`<li><button type="button" data-intent=${i.Leave}>Leave room</button></li>` : ''}</menu>`
      : html`<p>Pass the screen, or invite friends to an online room. Local matches save in this browser.</p>
        <fieldset><legend>Play online</legend>
          <label>Your name <input name="player-name" autocomplete="nickname" maxlength="24" value=${s.name} data-intent=${i.Name} /></label>
          <button type="button" data-intent=${i.Create}>Create room</button>
          <label>Room code <input name="room-code" maxlength="6" value=${s.room} data-intent=${i.Room} autocapitalize="characters" /></label>
          <button type="button" data-intent=${i.Join}>Join room</button>
        </fieldset>
        ${waiting ? html`<details class="local-setup"><summary>Local players</summary>
          <label>Player names, one per line <textarea name="local-players" rows="3" data-intent=${i.Names}>${s.names}</textarea></label>
          <button type="button" data-intent=${i.Setup}>Set local players</button></details>` : ''}`}
    ${waiting ? html`<section class="lobby" aria-labelledby="lobby-heading"><h3 id="lobby-heading">Before the first roll</h3>
      <ul class="seats">${each(table.players, p => p.id, seatRow, p => ({ host: p.id === lobby.host,
        ready: local || lobby.ready.includes(p.id), online: local || s.snapshot.online.includes(p.id) }))}</ul>
      <p>Two to eight players. Everyone rolls one die; the highest starts.</p>
      <menu>${seated ? html`<li><button type="button" data-intent=${i.Ready}>${ready ? 'Not ready' : 'Ready to play'}</button></li>` : ''}
        ${host ? html`<li><button type="button" class="primary" data-intent=${i.Start} ?disabled=${!canStart}>Start game</button></li>` : ''}
        ${host && !local ? html`<li><button type="button" data-intent=${i.Clock} aria-pressed=${String(lobby.clockSeconds > 0)}>60-second clock ${lobby.clockSeconds ? 'on' : 'off'}</button></li>` : ''}</menu>
      ${!local && !canStart ? html`<p>Waiting for everyone to connect and choose Ready to play.</p>` : ''}</section>` : ''}
  </section>`;
}
export function scorePanel(s: State) {
  const table = s.snapshot.table;
  return html`<aside class="scoreboard" aria-labelledby="score-heading"><h2 id="score-heading">The long game</h2>
    <table><caption>Banked points · Target ${table.match.target.toLocaleString('en-US')}</caption><thead><tr><th scope="col">Player</th><th scope="col">Score</th></tr></thead>
      <tbody>${each(table.players, p => p.id, scoreRow, p => ({ active: p.id === table.players[table.active]?.id && !['lobby', 'finished'].includes(table.match.stage), winner: table.match.winners.includes(p.id) }))}</tbody></table>
    <p>Reach 500 in one turn to get on the board. After that, bank any scoring turn.</p>
    ${table.match.stage === 'final' || table.match.stage === 'tiebreak' ? html`<p><strong>${table.match.stage === 'final' ? 'Final round' : `Sudden death · Round ${table.match.round}`}</strong><br />
      Still to play: ${table.match.queue.map(index => table.players[index]?.name).join(', ')}.</p>` : ''}
    <p><a href="#rules">Scoring and rules</a></p></aside>`;
}
