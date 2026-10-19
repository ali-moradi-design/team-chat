export interface ReadStateRepository {
  getMany(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, { lastReadMessageId?: string; muted: boolean }>>;
  pointersFor(conversationId: string, userIds: string[]): Promise<Record<string, string>>;
  upsertInitial(userId: string, conversationId: string, lastReadMessageId?: string): Promise<void>;
  advance(userId: string, conversationId: string, messageId: string): Promise<void>;
  setMuted(userId: string, conversationId: string, muted: boolean): Promise<void>;
  remove(userId: string, conversationId: string): Promise<void>;
}

export interface UnreadCounterPort {
  countUnread(
    userId: string,
    items: Array<{ conversationId: string; lastReadMessageId?: string }>,
  ): Promise<Map<string, { unread: number; mentions: number }>>;
}

export interface MembershipPort {
  requireMember(
    conversationId: string,
    userId: string,
  ): Promise<{ id: string; type: 'channel' | 'dm'; memberIds: string[] }>;
}

export interface MessageLookupPort {
  conversationIdOf(messageId: string): Promise<string | null>;
}
