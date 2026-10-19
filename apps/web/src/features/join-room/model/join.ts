import { getSocket, SocketEvents, type ChatMessage, type MessageAck } from '@/shared/lib/socket';
import { getLastMessageId, useChatStore } from '@/shared/lib/chat';

export function joinRoom(roomId: string): void {
  const socket = getSocket();
  const { setActiveRoom, upsertMessages, markJoined } = useChatStore.getState();
  setActiveRoom(roomId);
  markJoined(roomId);

  if (!socket) return;

  socket.emit(SocketEvents.RoomJoin, { roomId }, () => {
    const existing = useChatStore.getState().messagesByRoom[roomId];
    if (!existing || existing.length === 0) {
      socket.emit(
        SocketEvents.MessageHistory,
        { roomId, limit: 50 },
        (res: { ok?: boolean; messages?: ChatMessage[] }) => {
          if (res?.messages) upsertMessages(roomId, res.messages, 'replace');
        },
      );
    }
  });
}

export function createRoom(name: string): void {
  const socket = getSocket();
  if (!socket) return;
  socket.emit(
    SocketEvents.RoomCreate,
    { name },
    (res: { ok?: boolean; room?: { id: string } }) => {
      if (res?.ok && res.room) joinRoom(res.room.id);
    },
  );
}

function resyncRoom(roomId: string): void {
  const socket = getSocket();
  if (!socket?.connected) return;
  const { upsertMessages, markJoined } = useChatStore.getState();
  markJoined(roomId);
  const afterId = getLastMessageId(roomId);

  socket.emit(SocketEvents.RoomJoin, { roomId });

  if (afterId) {
    socket.emit(
      SocketEvents.MessageHistory,
      { roomId, afterId, limit: 100 },
      (res: { ok?: boolean; messages?: ChatMessage[] }) => {
        if (res?.messages?.length) upsertMessages(roomId, res.messages, 'append');
      },
    );
  } else {
    socket.emit(
      SocketEvents.MessageHistory,
      { roomId, limit: 50 },
      (res: { ok?: boolean; messages?: ChatMessage[] }) => {
        if (res?.messages) upsertMessages(roomId, res.messages, 'replace');
      },
    );
  }
}

/** Re-join all known rooms and cursor-sync history; retry failed/pending sends. */
export function resyncActiveRoom(): void {
  const { joinedRoomIds, activeRoomId, getPendingMessages, reconcileAck, markFailed } =
    useChatStore.getState();
  const rooms = new Set([...joinedRoomIds, activeRoomId, 'general']);
  for (const roomId of rooms) resyncRoom(roomId);

  const socket = getSocket();
  if (!socket?.connected) return;

  for (const msg of getPendingMessages()) {
    socket.emit(
      SocketEvents.MessageSend,
      {
        roomId: msg.roomId,
        text: msg.text,
        clientMsgId: msg.clientMsgId,
      },
      (ack: MessageAck) => {
        if (!ack?.ok) {
          markFailed(msg.clientMsgId);
          return;
        }
        reconcileAck(msg.clientMsgId, {
          id: ack.id,
          createdAt: ack.createdAt,
          status: 'sent',
        });
      },
    );
  }
}
