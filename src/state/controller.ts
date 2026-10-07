import { Name, RoomCode } from '../protocol/messages.ts';
import { localSession } from './local.ts';
import { remoteSession } from './remote.ts';
import type { Move } from '../game/table.ts';
import type { Session, Snapshot } from './session.ts';

/** Owns session lifetimes; components observe data and send commands through drivers. */
export class Controller {
  private session: Session;
  private listeners = new Set<(snapshot: Snapshot) => void>();
  private unsubscribe: () => void;
  private invitation: string | undefined;
  private name = '';
  constructor() {
    const code = new URL(location.href).searchParams.get('room');
    let name = '';
    try { name = localStorage.getItem('greed:name') ?? ''; } catch { /* Storage is optional. */ }
    this.name = name; this.invitation = code && RoomCode.safeParse(code).success ? code : undefined;
    this.session = code && RoomCode.safeParse(code).success && Name.safeParse(name).success ? remoteSession(code, name) : localSession();
    this.unsubscribe = this.session.subscribe(snapshot => this.publish(snapshot));
  }
  private decorate(snapshot: Snapshot): Snapshot { return { ...snapshot, invitation: this.invitation, suggestedName: this.name }; }
  private publish(snapshot: Snapshot): void { for (const listener of this.listeners) listener(this.decorate(snapshot)); }
  subscribe(listener: (snapshot: Snapshot) => void): () => void {
    this.listeners.add(listener); listener(this.decorate(this.session.get())); return () => { this.listeners.delete(listener); };
  }
  dispatch(move: Move): void { this.session.dispatch(move); }
  private replace(next: Session): void {
    this.unsubscribe(); this.session.close(); this.session = next;
    this.unsubscribe = next.subscribe(snapshot => this.publish(snapshot));
  }
  join(room: string, name: string): void {
    RoomCode.parse(room); Name.parse(name);
    this.name = name; this.invitation = room;
    try { localStorage.setItem('greed:name', name); } catch { /* Name can be entered again. */ }
    history.replaceState(null, '', `?room=${room}`); this.replace(remoteSession(room, name));
  }
  async create(name: string): Promise<void> {
    Name.parse(name);
    const response = await fetch('/api/rooms', { method: 'POST' });
    if (!response.ok) throw new Error('The room server is unavailable. Start it or try again later.');
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || !('room' in data)) throw new Error('Invalid room response.');
    this.join(RoomCode.parse(data.room), name);
  }
  local(): void {
    if (this.session.get().connection === 'online') this.session.dispatch({ type: 'Leave' });
    this.invitation = undefined; history.replaceState(null, '', '/'); this.replace(localSession());
  }
  setup(names: readonly string[]): void {
    if (names.length < 2 || names.length > 8) throw new Error('Enter two to eight player names, one per line.');
    const parsed = names.map(name => Name.parse(name));
    if (new Set(parsed).size !== parsed.length) throw new Error('Use a different name for each player.');
    this.invitation = undefined; history.replaceState(null, '', '/'); this.replace(localSession(parsed));
  }
  close(): void { this.unsubscribe(); this.session.close(); this.listeners.clear(); }
}
