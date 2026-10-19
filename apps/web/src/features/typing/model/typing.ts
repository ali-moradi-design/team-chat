import { getSocket, SocketEvents } from '@/shared/lib/socket';
import { useChatStore } from '@/shared/lib/chat';

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let isTyping = false;

export function notifyTyping(): void {
  const socket = getSocket();
  const roomId = useChatStore.getState().activeRoomId;
  if (!socket?.connected) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit(SocketEvents.TypingStart, { roomId });
  }

  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    stopTyping();
  }, 1500);
}

export function stopTyping(): void {
  const socket = getSocket();
  const roomId = useChatStore.getState().activeRoomId;
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  if (isTyping && socket) {
    socket.emit(SocketEvents.TypingStop, { roomId });
  }
  isTyping = false;
}
