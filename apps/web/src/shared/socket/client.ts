import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@team-chat/shared';
import { create } from 'zustand';
import { refreshSession } from '../api/http';
import { tokenStore } from '../api/token';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export const useConnection = create<{ state: ConnectionState; set: (s: ConnectionState) => void }>((set) => ({
  state: 'connecting',
  set: (state) => set({ state }),
}));

let socket: AppSocket | null = null;

export const getSocket = (): AppSocket | null => socket;

export function connectSocket(): AppSocket {
  if (socket) return socket;
  const s: AppSocket = io({
    path: '/socket.io',
    // WebSocket first: no long-polling round trips unless the network forces it.
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    auth: (cb) => cb({ token: tokenStore.get() }),
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
  });
  const conn = useConnection.getState();
  s.on('connect', () => conn.set('connected'));
  s.on('disconnect', (reason) => conn.set(reason === 'io client disconnect' ? 'offline' : 'reconnecting'));
  s.io.on('reconnect_attempt', () => useConnection.getState().set('reconnecting'));
  s.on('connect_error', async (err) => {
    // Expired access token: refresh, then let socket.io retry with the new token.
    if ((err as Error & { data?: { code?: string } }).data?.code === 'unauthorized') await refreshSession();
    useConnection.getState().set(navigator.onLine ? 'reconnecting' : 'offline');
  });
  window.addEventListener('online', () => s.connect());
  window.addEventListener('offline', () => useConnection.getState().set('offline'));
  socket = s;
  return s;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  useConnection.getState().set('connecting');
}
