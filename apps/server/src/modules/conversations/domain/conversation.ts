import type { Conversation, ConversationType, MemberRole } from '@team-chat/shared';
import { forbidden } from '../../../lib/errors';
import { isAdmin, type UserRecord } from '../../users';

export interface ConversationMember {
  userId: string;
  role: MemberRole;
}

export interface LastMessage {
  id: string;
  authorId: string;
  text: string;
  createdAt: Date;
}

export interface ConversationRecord {
  id: string;
  type: ConversationType;
  name?: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  members: ConversationMember[];
  createdAt: Date;
  lastMessageAt?: Date;
  lastMessage?: LastMessage;
}

export const DEFAULT_CHANNEL = 'general';

/** Stable key for a DM / group DM: the same set of people always maps to the same conversation. */
export function dmKey(userIds: string[]): string {
  return [...new Set(userIds)].sort().join(',');
}

/** "design team" → "design-team". Case is preserved for display, uniqueness uses `channelNameKey`. */
export function normalizeChannelName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^[#@]+/, '');
}

export const channelNameKey = (name: string): string => normalizeChannelName(name).toLowerCase();

export const isMember = (c: Pick<ConversationRecord, 'members'>, userId: string): boolean =>
  c.members.some((m) => m.userId === userId);

export const memberRole = (
  c: Pick<ConversationRecord, 'members'>,
  userId: string,
): MemberRole | undefined => c.members.find((m) => m.userId === userId)?.role;

/** Owners and workspace admins manage a channel (rename, remove people, ...). */
export function canManage(c: ConversationRecord, user: UserRecord): boolean {
  if (c.type !== 'channel') return false;
  return memberRole(c, user.id) === 'owner' || (isAdmin(user) && isMember(c, user.id));
}

export function assertMember(c: ConversationRecord, userId: string): void {
  if (!isMember(c, userId)) throw forbidden('You are not a member of this conversation');
}

export function toConversation(c: ConversationRecord): Conversation {
  return {
    id: c.id,
    type: c.type,
    ...(c.name ? { name: c.name } : {}),
    ...(c.topic ? { topic: c.topic } : {}),
    ...(c.description ? { description: c.description } : {}),
    isPrivate: c.isPrivate,
    members: c.members,
    createdAt: c.createdAt.toISOString(),
    ...(c.lastMessageAt ? { lastMessageAt: c.lastMessageAt.toISOString() } : {}),
    ...(c.lastMessage
      ? {
          lastMessage: {
            id: c.lastMessage.id,
            authorId: c.lastMessage.authorId,
            text: c.lastMessage.text,
            createdAt: c.lastMessage.createdAt.toISOString(),
          },
        }
      : {}),
  };
}
