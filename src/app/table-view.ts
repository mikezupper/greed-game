import { each, html, intents } from '@gyral/core';
import { emptyLobby } from '../protocol/messages.ts';
import { BUST_CHANCE, scoringDice } from '../game/odds.ts';
import { mini } from './glyphs.ts';
import { scoreboard } from './lanes.ts';
import { connectionLabel } from './screens.ts';
import { bankable, busy, fmt, owns, risk, selection, type Msg, type State } from './model.ts';

const i = intents<Msg>();
type Move = { readonly intent: 'Roll' | 'Bank' | 'Next' | 'Rematch' | 'Retry' | 'NewTable'; readonly label: string; readonly sub: string;
  readonly enabled: boolean; readonly tone: 'lead' | 'bank' | 'roll' | 'plain'; readonly risk?: number };
const riskBar = (dice: number | undefined) => dice === undefined ? '' : html`<span class="risk" aria-hidden="true"><b style="--risk: ${dice}"></b></span>`;
const moveButton = (m: Move) => html`<li><button type="button" class=${`move ${m.tone}`} data-intent=${i[m.intent]} ?disabled=${!m.enabled}>
  <span class="move-label">${m.label}</span>${m.sub ? html`<span class="move-sub">${riskBar(m.risk)}${m.sub}</span>` : ''}</button></li>`;
const rollMove = (dice: number, label: string, enabled: boolean, tone: Move['tone'], why: string): Move =>
  ({ intent: 'Roll', label, sub: enabled ? risk(dice) : why, enabled, tone, ...(enabled ? { risk: Math.round((BUST_CHANCE[dice] ?? 0) * 1000) / 10 } : {}) });

/** Every choice the active player has right now, with the reason when a choice is closed. */
function moves(s: State): readonly Move[] {
  const table = s.snapshot.table, lobby = s.snapshot.lobby ?? emptyLobby(), stage = table.match.stage;
  const host = s.snapshot.connection === 'local' || lobby.host === s.snapshot.playerId;
  const own = owns(s), locked = busy(s), player = table.players[table.active], dice = table.remaining.length;
  const wait = !own ? `${player?.name ?? 'Another player'} is playing` : locked ? 'Watch the dice settle' : '';
  if (lobby.paused) return [{ intent: 'Retry', label: 'Retry saved roll', sub: 'Same launch, same seed', enabled: own, tone: 'lead' },
    ...(host ? [{ intent: 'Rematch', label: 'Reset stalled match', sub: 'Scores return to zero', enabled: true, tone: 'plain' } as const] : [])];
  if (stage === 'finished') return host ? [{ intent: 'Rematch', label: 'Play again', sub: 'Same players, scores reset', enabled: true, tone: 'lead' },
    ...(s.snapshot.connection === 'local' ? [{ intent: 'NewTable', label: 'New table', sub: 'Choose new players', enabled: true, tone: 'plain' } as const] : [])] : [];
  if (stage === 'opening') return [{ intent: 'Roll', label: 'Roll 1 die', sub: wait || 'Highest die starts', enabled: own && !locked && table.phase === 'ready', tone: 'lead' }];
  if (table.phase === 'bust') {
    const next = table.match.queue.length && stage !== 'playing' ? table.match.queue[1] : (table.active + 1) % table.players.length;
    const name = next === undefined ? undefined : table.players[next]?.name;
    return [{ intent: 'Next', label: name ? `Pass the dice to ${name}` : 'Next player', sub: wait, enabled: own && !locked, tone: 'plain' }];
  }
  const open = own && !locked, chosen = selection(s), bankLabel = (points: number) => `Bank ${fmt(points)}`;
  if (table.phase === 'choosing') {
    if (chosen.keep === undefined || chosen.score === null) {
      const why = wait || (s.selected.length ? 'Those dice don’t score together' : 'Choose scoring dice first');
      return [{ intent: 'Bank', label: 'Bank', sub: why, enabled: false, tone: 'bank' }, rollMove(dice, 'Roll again', false, 'roll', why)];
    }
    const total = table.turnScore + chosen.score, left = table.dice.length - chosen.keep.length;
    const canBank = bankable(table, chosen.score);
    return [{ intent: 'Bank', label: bankLabel(total), sub: wait || (canBank ? 'Ends your turn' : 'Need 500 to get on the board'), enabled: open && canBank, tone: 'bank' },
      rollMove(left || 6, left ? `Roll ${left} ${left === 1 ? 'die' : 'dice'}` : 'Roll all 6 again', open, 'roll', wait)];
  }
  const rolling = table.phase === 'rolling', kept = table.phase === 'kept';
  return [{ intent: 'Bank', label: kept ? bankLabel(table.turnScore) : 'Bank', sub: wait || (rolling ? 'Dice are rolling' : kept ? 'Ends your turn' : 'Nothing at stake yet'),
    enabled: open && kept && bankable(table, 0), tone: 'bank' },
  rollMove(dice, `Roll ${dice} ${dice === 1 ? 'die' : 'dice'}`, open && !rolling, kept ? 'roll' : 'lead', wait || 'Dice are rolling')];
}

function overlay(s: State) {
  const table = s.snapshot.table, stage = table.match.stage, player = table.players[table.active];
  if (s.snapshot.connection === 'reconnecting') return html`<p class="banner-note">Reconnecting… Your seat is saved.</p>`;
  if (busy(s) && s.moment?.kind !== 'hot') return '';
  if (stage === 'finished') {
    const winners = table.players.filter(p => table.match.winners.includes(p.id));
    return html`<div class="crown"><p class="eyebrow">${winners.length > 1 ? 'Shared victory' : 'Winner'}</p>
      <p class="crown-name">${winners.map(p => p.name).join(' & ')}</p><p class="crown-score">${fmt(winners[0]?.score ?? 0)} points</p></div>`;
  }
  if (table.phase === 'bust') return html`<div class="stamp-wrap"><p class="stamp">Farkle</p>
    ${s.moment?.kind === 'farkle' && s.moment.points ? html`<p class="stamp-sub">${player?.name} loses ${fmt(s.moment.points)}</p>` : ''}</div>`;
  if (s.moment?.kind === 'hot' && table.phase === 'rolling') return html`<div class="hot"><b>Hot dice!</b><span>All six dice are back in play</span></div>`;
  if (table.phase === 'ready') return html`<p class="rest">${stage === 'opening' ? 'Opening roll. Highest die starts.'
    : `${owns(s) && s.snapshot.connection === 'online' ? 'Your' : `${player?.name}’s`} ${stage === 'final' || stage === 'tiebreak' ? 'last turn' : 'turn'}.`}</p>`;
  return '';
}

const host = (s: State) => s.snapshot.connection === 'local' || (s.snapshot.lobby ?? emptyLobby()).host === s.snapshot.playerId;
const heading = (s: State): string => {
  const table = s.snapshot.table, player = table.players[table.active], stage = table.match.stage;
  if (stage === 'finished') return 'Match complete';
  const who = owns(s) && s.snapshot.connection === 'online' ? 'Your turn' : `${player?.name ?? 'Waiting'}’s turn`;
  return stage === 'opening' ? `Opening roll · ${player?.name ?? ''}` : who;
};

export function tableScreen(s: State) {
  const { table, connection, playerId } = s.snapshot, lobby = s.snapshot.lobby ?? emptyLobby(), stage = table.match.stage;
  const own = owns(s), locked = busy(s), chosen = selection(s), choosing = table.phase === 'choosing' && stage !== 'opening';
  const seconds = lobby.deadline === null ? null : Math.max(0, Math.ceil((lobby.deadline - s.now - (s.snapshot.clockOffset ?? 0)) / 1000));
  const hints = s.hints && own && !locked && choosing ? scoringDice(table.dice.filter(d => !table.kept.some(k => k.id === d.id))) : [];
  const mood = table.phase === 'bust' && !locked ? 'bust' : stage === 'finished' ? 'won' : '';
  const seated = connection === 'online' && playerId !== null;
  return html`<div class="table-layout">
    <header class="table-bar">
      <p class="where" role="status">${s.snapshot.room ? html`Room <code class="room-code">${s.snapshot.room}</code> · ` : ''}${connectionLabel(s)}${connection === 'online' && playerId === null ? ' · Spectating' : ''}</p>
      <menu class="tools">
        <li><button type="button" class="tool" data-intent=${i.Hints} aria-pressed=${String(s.hints)}>Scoring hints</button></li>
        <li><button type="button" class="tool" data-intent=${i.Sound} aria-pressed=${String(s.sound)}>Sound</button></li>
        ${s.snapshot.room ? html`<li><button type="button" class="tool" data-intent=${i.Copy}>Copy invite link</button></li>` : ''}
        <li>${seated ? html`<button type="button" class="tool" data-intent=${i.Leave}>Leave room</button>`
          : html`<button type="button" class="tool" data-intent=${connection === 'local' ? i.NewTable : i.Local}>${connection === 'local' ? 'New table' : 'Back to start'}</button>`}</li>
      </menu>
    </header>
    <section class="play" aria-labelledby="turn-heading">
      <div class="table">
        <figure class="felt" data-mood=${mood} data-intent=${i.Playback} data-intent-on="dice-playback">
          <dice-tray .snapshot=${{ roll: s.snapshot.roll, kept: table.kept, selected: s.selected, dice: choosing || table.phase === 'bust' ? table.dice : [],
            enabled: own && !locked && choosing, hints }} data-intent=${i.Pick} data-intent-on="dice-pick"></dice-tray>
          <div class="overlay" aria-hidden="true">${overlay(s)}</div>
          <figcaption class="visually-hidden">The dice table. Choose dice with the buttons on each die.</figcaption>
        </figure>
        <div class="rail"><span class="rail-label">Held</span>${table.kept.length
          ? html`<span class="held" role="img" aria-label=${`Held this turn: ${table.kept.map(d => d.value).join(', ')}`}>${table.kept.map(d => mini(d.value))}</span>`
          : html`<span class="rail-empty">Dice you keep line up here.</span>`}</div>
        <div class="decide">
          <div class="turn">
            <h2 id="turn-heading" class="who">${heading(s)}<small>${stage === 'opening' ? 'Highest die starts' : `Turn ${table.turn}`}${stage === 'final' ? ' · Final round' : stage === 'tiebreak' ? ` · Sudden death ${table.match.round}` : ''}</small></h2>
            <p class="stake"><output class="turn-score" aria-describedby="stake-label">${fmt(stage === 'finished' ? Math.max(0, ...table.players.map(p => p.score)) : table.turnScore)}</output>
              <span id="stake-label">${stage === 'finished' ? 'winning score' : 'at stake'}</span></p>
            <p class="preview">${choosing && own ? (s.selected.length
              ? chosen.score === null ? html`${chosen.values.map(mini)}<span class="bad">Every kept die has to score.</span>`
                : html`${chosen.values.map(mini)}<b>+${fmt(chosen.score)}</b>${chosen.keep?.length === table.dice.length ? html`<span class="tag">Hot dice</span>` : ''}`
              : html`<span>Tap the dice you want to keep.</span>`) : ''}
              ${choosing && own ? html`<button type="button" class="link" data-intent=${i.Suggest} ?disabled=${locked}>Select scoring dice</button>` : ''}</p>
          </div>
          <menu class="moves">${each(moves(s), m => m.intent, moveButton)}</menu>
          ${seconds !== null ? html`<p class="clock" role="timer" aria-label="Decision time remaining" style="--left: ${Math.min(1, seconds / Math.max(1, lobby.clockSeconds))}">
            <span class="clock-bar" aria-hidden="true"></span>${seconds} seconds to decide</p>` : ''}
          <p class="status" role="status" aria-atomic="true">${locked ? 'Watch the dice. Controls unlock when they settle.' : table.notice}</p>
          ${!host(s) && stage === 'finished' ? html`<p class="status">Waiting for the host to open a rematch.</p>` : ''}
          ${s.error || s.snapshot.error ? html`<p role="alert">${s.error ?? s.snapshot.error}</p>` : ''}
        </div>
      </div>
    </section>
    ${scoreboard(s)}
  </div>`;
}
