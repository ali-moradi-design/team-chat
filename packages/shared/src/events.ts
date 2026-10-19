import type { Ack } from './errors';
import type {
  Conversation,
  ConversationSummary,
  Me,
  Message,
  PresenceStatus,
  Reaction,
  SendMessageBody,
  User,
} from './schemas';

export interface ServerToClientEvents {
  ready: (payload: { me: Me; presence: Record<string, PresenceStatus> }) => void;
  'message:new': (payload: { message: Message }) => void;
  /** Edit, soft delete, pin change. */
  'message:updated': (payload: { message: Message }) => void;
  'reaction:updated': (payload: {
    conversationId: string;
    messageId: string;
    reactions: Reaction[];
  }) => void;
  'thread:updated': (payload: {
    conversationId: string;
    rootId: string;
    replyCount: number;
    lastReplyAt: string;
  }) => void;
  typing: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'presence:update': (payload: { userId: string; status: PresenceStatus }) => void;
  'read:updated': (payload: { conversationId: string; userId: string; messageId: string }) => void;
  'conversation:upsert': (payload: { conversation: ConversationSummary }) => void;
  'conversation:updated': (payload: { conversation: Conversation }) => void;
  'conversation:removed': (payload: { conversationId: string }) => void;
  'user:upsert': (payload: { user: User }) => void;
}

export interface ClientToServerEvents {
  'message:send': (body: SendMessageBody, ack: (res: Ack<{ message: Message }>) => void) => void;
  'message:edit': (
    body: { messageId: string; text: string },
    ack: (res: Ack<{ message: Message }>) => void,
  ) => void;
  'message:delete': (
    body: { messageId: string },
    ack: (res: Ack<{ message: Message }>) => void,
  ) => void;
  'message:pin': (
    body: { messageId: string; pinned: boolean },
    ack: (res: Ack<{ message: Message }>) => void,
  ) => void;
  'reaction:toggle': (
    body: { messageId: string; emoji: string },
    ack: (res: Ack<{ reactions: Reaction[] }>) => void,
  ) => void;
  typing: (body: { conversationId: string; isTyping: boolean }) => void;
  'read:update': (
    body: { conversationId: string; messageId: string },
    ack?: (res: Ack) => void,
  ) => void;
  'presence:set': (body: { status: 'online' | 'away' }) => void;
}

export type SocketData = { userId: string; status: 'online' | 'away' };
