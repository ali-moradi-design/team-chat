import { io, type Socket } from 'socket.io-client';
import { env } from '@/shared/config';

let socket: Socket | null = null;

export type AuthPayload = {
  displayName: string;
  userId?: string;
};

/**
 * Singleton Socket.IO client. Reuses one connection across the app.
 * Call `connectSocket` after display-name gate; `getSocket` thereafter.
 */
export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(auth: AuthPayload): Socket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = auth;
    socket.connect();
    return socket;
  }

  socket = io(env.socketUrl, {
    autoConnect: true,
    auth,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    timeout: 12000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
