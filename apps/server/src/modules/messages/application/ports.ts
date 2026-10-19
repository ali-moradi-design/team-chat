import type { Reaction } from '@team-chat/shared';
import type { MessageRecord, StoredAttachment } from '../domain/message';

export interface NewMessage {
  conversationId: string;
  authorId: string;
  text: string;
  attachments: StoredAttachment[];
  mentions: string[];
  mentionsAll: boolean;
  threadRootId?: string;
  clientMsgId: string;
}

export interface HistoryParams {
  beforeId?: string;
  afterId?: string;
  aroundId?: string;
  limit: number;
}

export interface HistoryPage {
  messages: MessageRecord[];
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
}

export interface MessageRepository {
  insert(input: NewMessage): Promise<MessageRecord>;
  findById(id: string): Promise<MessageRecord | null>;
  findByClientMsgId(
    conversationId: string,
    authorId: string,
    clientMsgId: string,
  ): Promise<MessageRecord | null>;
  history(conversationId: string, params: HistoryParams): Promise<HistoryPage>;
  replies(rootId: string, limit: number): Promise<MessageRecord[]>;
  pins(conversationId: string): Promise<MessageRecord[]>;
  updateText(
    id: string,
    text: string,
    mentions: string[],
    mentionsAll: boolean,
  ): Promise<MessageRecord | null>;
  softDelete(id: string): Promise<MessageRecord | null>;
  toggleReaction(
    id: string,
    userId: string,
    emoji: string,
    maxEmojis: number,
  ): Promise<Reaction[] | null>;
  setPinned(id: string, pinned: boolean): Promise<MessageRecord | null>;
  registerReply(
    rootId: string,
    at: Date,
  ): Promise<{ replyCount: number; lastReplyAt: Date } | null>;
  search(params: {
    text: string;
    conversationIds: string[];
    authorId?: string;
    beforeId?: string;
    limit: number;
  }): Promise<{ results: MessageRecord[]; hasMore: boolean }>;
  countUnread(
    userId: string,
    items: Array<{ conversationId: string; lastReadMessageId?: string }>,
  ): Promise<Map<string, { unread: number; mentions: number }>>;
}

/** Attachments are owned by the files module. */
export interface AttachmentPort {
  resolveForSend(userId: string, fileIds: string[]): Promise<StoredAttachment[]>;
  markAttached(fileIds: string[], conversationId: string, messageId: string): Promise<void>;
}

/** Read-state side effects of sending (implemented by read-states). */
export interface ReadPointerPort {
  /** Advances the pointer without broadcasting (the sender's own message). */
  markReadSilently(userId: string, conversationId: string, messageId: string): Promise<void>;
}
