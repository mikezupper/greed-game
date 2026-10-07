import { newTable } from '../game/table.ts';
import { ServerMessage, type ClientMessage } from '../protocol/messages.ts';
import { cell, type Session } from './session.ts';

export function remoteSession(room: string, name: string): Session {
  const state = cell({ table: newTable([]), roll: null, room, revision: 0, playerId: null, online: [], connection: 'connecting', error: null });
  let socket: WebSocket | undefined, stopped = false, attempt = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let token: string | undefined;
  try { token = localStorage.getItem(`greed:seat:${room}`) ?? undefined; } catch { /* Session still works without storage. */ }
  const open = () => {
    if (stopped) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); socket = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'Join', room, name, ...(token ? { token } : {}) } satisfies ClientMessage));
    ws.onmessage = event => {
      if (stopped || socket !== ws) return;
      let raw: unknown;
      try { raw = JSON.parse(String(event.data)); } catch { return; }
      const parsed = ServerMessage.safeParse(raw);
      if (!parsed.success) { state.set({ ...state.get(), error: 'The server sent an incompatible update.' }); return; }
      const message = parsed.data, current = state.get();
      if (message.type === 'Welcome') {
        token = message.token ?? undefined; attempt = 0;
        try { if (token) localStorage.setItem(`greed:seat:${room}`, token); } catch { /* In-memory reconnect remains available. */ }
        state.set({ ...current, playerId: message.playerId, connection: 'online', error: null });
      } else if (message.type === 'Snapshot') {
        if (message.view.revision < current.revision) return;
        state.set({ ...current, ...message.view, room: message.view.code, connection: 'online', error: null,
          clockOffset: message.serverTime === undefined ? 0 : message.serverTime - Date.now() });
      } else if (message.type === 'Rejected') {
        if (!message.id && (current.connection === 'connecting' || current.connection === 'reconnecting')) {
          stopped = true; ws.close(); state.set({ ...current, connection: 'closed', error: message.message });
        } else state.set({ ...current, error: message.message });
      } else if (message.type === 'Replaced' || message.type === 'Left') {
        stopped = true; clearTimeout(timer); ws.close();
        state.set({ ...current, playerId: null, connection: 'closed', error: message.type === 'Replaced'
          ? 'Your seat is open in another tab. Use that tab or reload to take it back.' : 'You left the room. Your seat token is kept for this match.' });
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (stopped || socket !== ws) return;
      state.set({ ...state.get(), connection: 'reconnecting' });
      timer = setTimeout(open, Math.min(10_000, 500 * 2 ** attempt++) + Math.random() * 250);
    };
  };
  open();
  return { ...state,
    dispatch: move => {
      const current = state.get();
      if (socket?.readyState !== WebSocket.OPEN || current.connection !== 'online') { state.set({ ...current, error: 'Wait for the table to reconnect.' }); return; }
      socket.send(JSON.stringify({ type: 'Act', id: crypto.randomUUID(), revision: current.revision, move } satisfies ClientMessage));
    },
    close: () => { stopped = true; clearTimeout(timer); socket?.close(); state.set({ ...state.get(), connection: 'closed' }); },
  };
}
