import { z } from 'zod';
import { LIMITS } from '../constants';
import { isoDate, objectId, plainText } from './common';

export const conversationType = z.enum(['channel', 'dm']);
export type ConversationType = z.infer<typeof conversationType>;

export const memberRole = z.enum(['owner', 'member']);
export type MemberRole = z.infer<typeof memberRole>;

export const memberSchema = z.object({ userId: objectId, role: memberRole });
export type Member = z.infer<typeof memberSchema>;

export const lastMessagePreview = z.object({
  id: objectId,
  authorId: objectId,
  text: z.string(),
  createdAt: isoDate,
});

export const conversationSchema = z.object({
  id: objectId,
  type: conversationType,
  name: z.string().optional(),
  topic: z.string().optional(),
  description: z.string().optional(),
  isPrivate: z.boolean(),
  members: z.array(memberSchema),
  createdAt: isoDate,
  lastMessageAt: isoDate.optional(),
  lastMessage: lastMessagePreview.optional(),
});
export type Conversation = z.infer<typeof conversationSchema>;

/** Conversation as seen by one user (adds per-user state). */
export const conversationSummarySchema = conversationSchema.extend({
  unreadCount: z.number().int().nonnegative(),
  mentionCount: z.number().int().nonnegative(),
  muted: z.boolean(),
  lastReadMessageId: objectId.optional(),
  /** Last-read pointers of the other members (DM "seen by"). */
  peerReads: z.record(z.string(), objectId).optional(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const channelNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(LIMITS.nameMaxLength)
  .regex(/^[^\s#@][^\n]*$/u, 'Invalid name');

export const createChannelBody = z.object({
  name: channelNameSchema,
  topic: plainText(LIMITS.topicMaxLength).optional(),
  description: plainText(LIMITS.descriptionMaxLength).optional(),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(objectId).max(200).default([]),
});
export type CreateChannelBody = z.infer<typeof createChannelBody>;

export const createDmBody = z.object({
  userIds: z
    .array(objectId)
    .min(1)
    .max(LIMITS.maxDmMembers - 1),
});

export const updateConversationBody = z
  .object({
    name: channelNameSchema,
    topic: z.string().trim().max(LIMITS.topicMaxLength),
    description: z.string().trim().max(LIMITS.descriptionMaxLength),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const addMembersBody = z.object({ userIds: z.array(objectId).min(1).max(200) });
export const muteBody = z.object({ muted: z.boolean() });
export const markReadBody = z.object({ messageId: objectId });
