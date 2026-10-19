import { z } from 'zod';
import { LIMITS } from '../constants';
import { emojiSchema, isoDate, objectId } from './common';
import { attachmentSchema } from './file';

export const reactionSchema = z.object({ emoji: z.string(), userIds: z.array(objectId) });
export type Reaction = z.infer<typeof reactionSchema>;

export const messageSchema = z.object({
  id: objectId,
  conversationId: objectId,
  authorId: objectId,
  text: z.string(),
  attachments: z.array(attachmentSchema),
  reactions: z.array(reactionSchema),
  mentions: z.array(objectId),
  mentionsAll: z.boolean().default(false),
  threadRootId: objectId.optional(),
  replyCount: z.number().int().nonnegative(),
  lastReplyAt: isoDate.optional(),
  pinned: z.boolean(),
  editedAt: isoDate.optional(),
  deletedAt: isoDate.optional(),
  createdAt: isoDate,
  clientMsgId: z.string().optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const clientMsgId = z.string().min(8).max(64);

export const sendMessageBody = z.object({
  conversationId: objectId,
  clientMsgId,
  text: z.string().max(LIMITS.messageMaxLength),
  attachmentIds: z.array(objectId).max(LIMITS.maxAttachmentsPerMessage).default([]),
  threadRootId: objectId.optional(),
});
export type SendMessageBody = z.infer<typeof sendMessageBody>;

export const editMessageBody = z.object({
  messageId: objectId,
  text: z.string().trim().min(1).max(LIMITS.messageMaxLength),
});
export const deleteMessageBody = z.object({ messageId: objectId });
export const toggleReactionBody = z.object({ messageId: objectId, emoji: emojiSchema });
export const pinMessageBody = z.object({ messageId: objectId, pinned: z.boolean() });

export const historyQuery = z.object({
  beforeId: objectId.optional(),
  afterId: objectId.optional(),
  aroundId: objectId.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.historyMaxPageSize)
    .default(LIMITS.historyPageSize),
});
export type HistoryQuery = z.infer<typeof historyQuery>;

export const historyResponse = z.object({
  messages: z.array(messageSchema),
  hasMoreOlder: z.boolean(),
  hasMoreNewer: z.boolean(),
});
export type HistoryResponse = z.infer<typeof historyResponse>;

export const threadResponse = z.object({
  root: messageSchema,
  replies: z.array(messageSchema),
});
export type ThreadResponse = z.infer<typeof threadResponse>;

export const searchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  conversationId: objectId.optional(),
  authorId: objectId.optional(),
  beforeId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(LIMITS.searchPageSize),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const searchResponse = z.object({
  results: z.array(messageSchema),
  hasMore: z.boolean(),
});
export type SearchResponse = z.infer<typeof searchResponse>;
