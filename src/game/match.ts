import type { Table, Player, Die } from './table.ts';

export interface Match {
  readonly stage: 'lobby' | 'opening' | 'playing' | 'final' | 'tiebreak' | 'finished';
  readonly target: number;
  readonly queue: readonly number[];
  readonly contenders: readonly number[];
  readonly opening: readonly { readonly player: number; readonly value: number }[];
  readonly winners: readonly string[];
  readonly round: number;
}
export const matchState = (stage: Match['stage'] = 'playing', target = 10_000): Match => ({
  stage, target, queue: [], contenders: [], opening: [], winners: [], round: 0,
});
export function beginMatch(table: Table): Table {
  const queue = table.players.map((_, i) => i);
  return { ...table, started: true, active: 0, remaining: [0], dice: [], kept: [], turnScore: 0,
    match: { ...matchState('opening', table.match.target), queue }, notice: 'Opening roll: highest die starts. Tied leaders roll again.' };
}
export function openingResult(table: Table, value: number): Table {
  const opening = [...table.match.opening, { player: table.active, value }], queue = table.match.queue.slice(1);
  if (queue.length) return { ...table, active: queue[0] ?? 0, phase: 'ready', match: { ...table.match, opening, queue },
    notice: `${table.players[table.active]?.name} rolled ${value || 'no die'}. Next opening roll.` };
  const high = Math.max(...opening.map(r => r.value)), leaders = opening.filter(r => r.value === high).map(r => r.player);
  if (leaders.length > 1) return { ...table, active: leaders[0] ?? 0, phase: 'ready',
    match: { ...table.match, queue: leaders, opening: [], round: table.match.round + 1 }, notice: 'Opening tie. Only the tied leaders roll again.' };
  return { ...table, active: leaders[0] ?? 0, phase: 'ready', remaining: [0, 1, 2, 3, 4, 5], dice: [],
    match: matchState('playing', table.match.target), notice: `${table.players[leaders[0] ?? 0]?.name} starts. Roll six dice.` };
}
export function endTurn(table: Table, bank: boolean): Table {
  const players = table.players.map((p, i) => i === table.active && bank ? { ...p, score: p.score + table.turnScore } : p);
  let match = table.match, active = (table.active + 1) % players.length;
  let notice = bank ? `${table.players[table.active]?.name} banked ${table.turnScore} points.` : 'No points this turn. Next player.';
  if (match.stage === 'playing' && (players[table.active]?.score ?? 0) >= match.target) {
    const queue = Array.from({ length: players.length - 1 }, (_, i) => (table.active + i + 1) % players.length);
    match = { ...match, stage: 'final', queue }; active = queue[0] ?? active;
    notice += ' Final round: everyone else gets one turn.';
  } else if (match.stage === 'final' || match.stage === 'tiebreak') {
    const queue = match.queue.slice(1); match = { ...match, queue };
    if (queue.length) active = queue[0] ?? active;
    else {
      const eligible = match.stage === 'final' ? players.map((_, i) => i) : match.contenders;
      const high = Math.max(...eligible.map(i => players[i]?.score ?? 0));
      const leaders = eligible.filter(i => players[i]?.score === high);
      if (leaders.length === 1) {
        active = leaders[0] ?? 0; match = { ...match, stage: 'finished', winners: leaders.map(i => players[i]?.id ?? '') };
        notice = `${players[active]?.name} wins with ${high.toLocaleString('en-US')} points!`;
      } else {
        active = leaders[0] ?? 0; match = { ...match, stage: 'tiebreak', queue: leaders, contenders: leaders, round: match.round + 1 };
        notice = 'Tied leaders play another round. Everyone tied gets one turn before scores are compared.';
      }
    }
  }
  return { ...table, players, match, active, phase: 'ready', turn: table.turn + 1, turnScore: 0,
    remaining: [0, 1, 2, 3, 4, 5], dice: [], kept: [], notice };
}
export const canBank = (table: Table): boolean => table.turnScore > 0
  && ((table.players[table.active]?.score ?? 0) > 0 || table.turnScore >= 500);
export function expireTurn(table: Table): Table {
  if (table.match.stage === 'opening') return openingResult(table, 0);
  if (['lobby', 'finished'].includes(table.match.stage)) return table;
  const bank = canBank(table), next = endTurn(table, bank);
  return { ...next, notice: `Turn timed out. ${bank ? `Banked ${table.turnScore} committed points.` : 'Unbanked points forfeited.'} ${next.notice}` };
}
export function validPlayers(players: readonly Player[]): boolean {
  return players.length >= 2 && players.length <= 8 && new Set(players.map(p => p.id)).size === players.length;
}
export function validDice(table: Table, dice: readonly Die[]): boolean {
  return dice.length === table.remaining.length && new Set(dice.map(d => d.id)).size === dice.length
    && dice.every(d => table.remaining.includes(d.id) && Number.isInteger(d.value) && d.value >= 1 && d.value <= 6);
}
