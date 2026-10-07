import { each, html } from '@gyral/core';
import { fmt, selection, type State } from './model.ts';

interface Lane {
  readonly active: boolean; readonly winner: boolean; readonly fill: number; readonly ghost: number; readonly gain: number; readonly badge: string; readonly entry: boolean; readonly offline: boolean;
}
const laneRow = (p: { readonly id: string; readonly name: string; readonly score: number }, lane: Lane) => html`
  <tr class=${`lane${lane.active ? ' is-active' : ''}${lane.winner ? ' is-winner' : ''}`} aria-current=${lane.active ? 'true' : 'false'}>
    <th scope="row"><span class="lane-name"><bdi>${p.name}</bdi></span>
      <span class="badges">${lane.badge ? html`<span class=${`badge${lane.winner ? ' win' : lane.active ? ' turn' : ''}`}>${lane.badge}</span>` : ''}
        ${lane.entry ? html`<span class="badge entry">Not on the board</span>` : ''}${lane.offline ? html`<span class="badge">Offline</span>` : ''}</span>
      <span class="track" aria-hidden="true"><span class="fill" style="--fill: ${lane.fill}"></span><span class="ghost" style="--from: ${lane.fill}; --ghost: ${lane.ghost}"></span></span></th>
    <td><span class="lane-score">${fmt(p.score)}</span>${lane.gain ? html`<span class="plus" aria-hidden="true">+${fmt(lane.gain)}</span>` : ''}</td>
  </tr>`;

/** Banked scores as a race to the target; the striped segment is what banking now would add. */
export function scoreboard(s: State) {
  const { table, connection, online } = s.snapshot, match = table.match, stage = match.stage, target = match.target;
  const chosen = selection(s), pending = table.turnScore + (table.phase === 'choosing' ? chosen.score ?? 0 : 0);
  const playing = !['lobby', 'finished', 'opening'].includes(stage);
  const still = stage === 'final' || stage === 'tiebreak' ? match.queue.map(index => table.players[index]?.name).filter(Boolean) : [];
  const lane = (p: { readonly id: string; readonly score: number }, index: number): Lane => {
    const active = index === table.active && stage !== 'finished', winner = match.winners.includes(p.id);
    const fill = Math.min(1, p.score / target), opening = match.opening.find(r => r.player === index);
    const moment = s.moment?.kind === 'bank' && s.moment.player === p.id ? s.moment : null;
    return { active, winner, fill, ghost: active && playing ? Math.min(1 - fill, pending / target) : 0, gain: moment?.points ?? 0,
      badge: winner ? 'Winner' : stage === 'opening' && opening ? `Rolled ${opening.value}` : active ? (stage === 'opening' ? 'Rolling' : 'Playing')
        : still.length && match.queue.includes(index) ? 'One turn left' : '',
      entry: playing && p.score === 0, offline: connection !== 'local' && !online.includes(p.id) };
  };
  return html`<aside class="scoreboard" aria-labelledby="score-heading">
    <h2 id="score-heading">Race to ${fmt(target)}</h2>
    ${still.length ? html`<p class="final-chip"><b>${stage === 'final' ? 'Final round' : `Sudden death · Round ${match.round}`}</b>
      Still to play: ${still.join(', ')}.</p>` : ''}
    <table class="lanes"><caption class="visually-hidden">Banked points. Target ${fmt(target)}.</caption>
      <thead class="visually-hidden"><tr><th scope="col">Player</th><th scope="col">Score</th></tr></thead>
      <tbody>${each(table.players, p => p.id, laneRow, p => lane(p, table.players.indexOf(p)))}</tbody></table>
    <p class="lane-note">Bank 500 in one turn to get on the board. After that, bank any scoring turn.</p>
    <p class="lane-note"><a href="#rules">Scoring and rules</a></p>
  </aside>`;
}
