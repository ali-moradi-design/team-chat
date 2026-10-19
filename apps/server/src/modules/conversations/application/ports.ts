import type { MemberRole } from '@team-chat/shared';
import type { ConversationMember, ConversationRecord, LastMessage } from '../domain/conversation';

export interface NewConversation {
  type: 'channel' | 'dm';
  name?: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  members: ConversationMember[];
  createdBy: string;
}

export interface ConversationRepository {
  create(input: NewConversation): Promise<ConversationRecord>;
  findById(id: string): Promise<ConversationRecord | null>;
  findChannelByName(name: string): Promise<ConversationRecord | null>;
  findDmByMembers(userIds: string[]): Promise<ConversationRecord | null>;
  listForUser(userId: string): Promise<ConversationRecord[]>;
  listPublicNotJoined(userId: string): Promise<ConversationRecord[]>;
  idsForUser(userId: string): Promise<string[]>;
  update(
    id: string,
    patch: { name?: string; topic?: string; description?: string },
  ): Promise<ConversationRecord | null>;
  addMembers(id: string, members: ConversationMember[]): Promise<ConversationRecord | null>;
  removeMember(id: string, userId: string): Promise<ConversationRecord | null>;
  setMemberRole(id: string, userId: string, role: MemberRole): Promise<void>;
  setLastMessage(id: string, last: LastMessage): Promise<void>;
}

/** Per-user conversation state, implemented by the read-states module. */
export interface ReadStatePort {
  getStates(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, { lastReadMessageId?: string; muted: boolean }>>;
  unreadCounts(
    userId: string,
    items: Array<{ conversationId: string; lastReadMessageId?: string }>,
  ): Promise<Map<string, { unread: number; mentions: number }>>;
  peerReads(conversationId: string, userIds: string[]): Promise<Record<string, string>>;
  init(userId: string, conversationId: string, lastReadMessageId?: string): Promise<void>;
  setMuted(userId: string, conversationId: string, muted: boolean): Promise<void>;
  remove(userId: string, conversationId: string): Promise<void>;
}
