export interface ChatUser {
  id: string;
  displayName: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  clientMsgId: string;
  roomId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
  /** Client-only status for optimistic UI */
  status?: 'pending' | 'sent' | 'failed';
}

export interface PresenceUser {
  id: string;
  displayName: string;
}

export type ConnStatus = 'connected' | 'reconnecting' | 'offline';

export interface MessageAckOk {
  ok: true;
  id: string;
  clientMsgId: string;
  createdAt: string;
  duplicate?: boolean;
}

export interface MessageAckErr {
  ok: false;
  clientMsgId?: string;
  error: string;
}

export type MessageAck = MessageAckOk | MessageAckErr;
