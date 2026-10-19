import { EventEmitter } from 'node:events';
import type {
  Conversation,
  ConversationSummary,
  Message,
  PresenceStatus,
  Reaction,
  User,
} from '@team-chat/shared';

/** Domain events published by the application layer and consumed by the realtime gateway. */
export interface DomainEvents {
  'message.created': { message: Message; memberIds?: string[] };
  'message.updated': { message: Message };
  'reaction.updated': { conversationId: string; messageId: string; reactions: Reaction[] };
  'thread.updated': {
    conversationId: string;
    rootId: string;
    replyCount: number;
    lastReplyAt: string;
  };
  'conversation.created': { summaries: Array<{ userId: string; summary: ConversationSummary }> };
  'conversation.updated': { conversation: Conversation };
  'conversation.members-added': {
    conversationId: string;
    summaries: Array<{ userId: string; summary: ConversationSummary }>;
  };
  'conversation.member-removed': { conversationId: string; userId: string };
  'read.updated': { conversationId: string; userId: string; messageId: string; notify: string[] };
  'user.updated': { user: User };
  'presence.changed': { userId: string; status: PresenceStatus };
}

export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: false });

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publish<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  subscribe<K extends keyof DomainEvents>(
    event: K,
    handler: (payload: DomainEvents[K]) => void,
  ): () => void {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}
