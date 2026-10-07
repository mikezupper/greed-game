import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ServerMessage, type ClientMessage, type RoomView } from '../../src/protocol/messages.ts';
import type { Move } from '../../src/game/table.ts';

export class Client {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;
  readonly ready: Promise<void>;
  constructor(base: string) {
    this.socket = new WebSocket(`ws://${base}/ws`);
    this.ready = new Promise((resolve, reject) => { this.socket.onopen = () => resolve(); this.socket.onerror = reject; });
    this.socket.onmessage = event => this.messages.push(ServerMessage.parse(JSON.parse(String(event.data))));
  }
  get view(): RoomView | undefined {
    const message = this.messages.findLast(m => m.type === 'Snapshot');
    return message?.type === 'Snapshot' ? message.view : undefined;
  }
  get token(): string | undefined {
    const message = this.messages.find(m => m.type === 'Welcome');
    return message?.type === 'Welcome' ? message.token ?? undefined : undefined;
  }
  get playerId(): string | null {
    const message = this.messages.find(m => m.type === 'Welcome');
    return message?.type === 'Welcome' ? message.playerId : null;
  }
  send(message: ClientMessage): void { this.socket.send(JSON.stringify(message)); }
  async join(room: string, name: string, token?: string): Promise<void> {
    await this.ready; this.send({ type: 'Join', room, name, ...(token ? { token } : {}) });
    await this.wait(m => m.type === 'Snapshot');
  }
  act(move: Move, id = randomUUID()): Extract<ClientMessage, { type: 'Act' }> {
    const message = { type: 'Act' as const, id, revision: this.view?.revision ?? 0, move }; this.send(message); return message;
  }
  async wait(predicate: (message: ServerMessage) => boolean, after = 0): Promise<ServerMessage> {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const found = this.messages.slice(after).find(predicate);
      if (found) return found;
      await delay(10);
    }
    throw new Error(`No matching message; received ${this.messages.slice(after).map(m => m.type === 'Rejected' ? `Rejected: ${m.message}` : m.type).join(', ')}.`);
  }
  close(): void { this.socket.close(); }
}
export async function createRoom(base: string): Promise<string> {
  const response = await fetch(`http://${base}/api/rooms`, { method: 'POST' });
  if (response.status !== 201) throw new Error('Cannot create room.');
  return (await response.json() as { room: string }).room;
}
export async function synchronize(a: Client, b: Client): Promise<void> {
  const revision = Math.max(a.view?.revision ?? 0, b.view?.revision ?? 0);
  for (const client of [a, b]) await client.wait(m => m.type === 'Snapshot' && m.view.revision >= revision);
}
export async function startMatch(a: Client, b: Client, respectPlayback = false): Promise<void> {
  await a.wait(m => m.type === 'Snapshot' && m.view.table.players.length === 2);
  await synchronize(a, b);
  for (const client of [a, b]) {
    const from = client.messages.length, command = client.act({ type: 'Ready', ready: true });
    await client.wait(m => m.type === 'Ack' && m.id === command.id, from); await synchronize(a, b);
  }
  const from = a.messages.length; a.act({ type: 'Start' });
  await a.wait(m => m.type === 'Snapshot' && m.view.table.match.stage === 'opening', from); await synchronize(a, b);
  for (let i = 0; i < 100 && a.view?.table.match.stage === 'opening'; i++) {
    const active = a.view.table.players[a.view.table.active]?.id === a.playerId ? a : b;
    if (respectPlayback) await delay(Math.max(0, (active.view?.lobby.playbackUntil ?? 0) - Date.now()) + 10);
    const offset = active.messages.length; active.act({ type: 'Roll' });
    await active.wait(m => m.type === 'Snapshot' && m.view.table.phase !== 'rolling', offset); await synchronize(a, b);
  }
  if (a.view?.table.match.stage !== 'playing') throw new Error('Opening rolls did not complete.');
}
