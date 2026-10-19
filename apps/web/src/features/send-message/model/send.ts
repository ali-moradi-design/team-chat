import { v4 as uuidv4 } from 'uuid';
import { getSocket, SocketEvents, type MessageAck } from '@/shared/lib/socket';
import { useChatStore } from '@/shared/lib/chat';

function emitSend(
  roomId: string,
  text: string,
  clientMsgId: string,
): void {
  const socket = getSocket();
  const { reconcileAck, markFailed, setLastError } = useChatStore.getState();

  if (!socket || !socket.connected) {
    markFailed(clientMsgId);
    setLastError('Cannot send while offline');
    return;
  }

  socket.emit(
    SocketEvents.MessageSend,
    { roomId, text, clientMsgId },
    (ack: MessageAck) => {
      if (!ack?.ok) {
        markFailed(clientMsgId);
        setLastError(ack?.error ?? 'Failed to send message');
        return;
      }
      reconcileAck(clientMsgId, {
        id: ack.id,
        createdAt: ack.createdAt,
        status: 'sent',
      });
    },
  );
}

export function sendMessage(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const { activeRoomId, userId, displayName, addOptimistic } = useChatStore.getState();
  if (!userId || !displayName) return;

  const clientMsgId = uuidv4();
  const optimistic = {
    id: clientMsgId,
    clientMsgId,
    roomId: activeRoomId,
    userId,
    displayName,
    text: trimmed.slice(0, 4000),
    createdAt: new Date().toISOString(),
    status: 'pending' as const,
  };

  addOptimistic(optimistic);
  emitSend(activeRoomId, optimistic.text, clientMsgId);
}

export function retryMessage(clientMsgId: string): void {
  const { messagesByRoom, reconcileAck } = useChatStore.getState();
  for (const list of Object.values(messagesByRoom)) {
    const msg = list.find((m) => m.clientMsgId === clientMsgId);
    if (msg && (msg.status === 'failed' || msg.status === 'pending')) {
      reconcileAck(clientMsgId, { status: 'pending' });
      emitSend(msg.roomId, msg.text, clientMsgId);
      return;
    }
  }
}
