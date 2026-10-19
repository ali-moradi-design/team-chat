import type {
  HistoryQuery,
  HistoryResponse,
  Message,
  Reaction,
  SearchQuery,
  SearchResponse,
  SendMessageBody,
  ThreadResponse,
} from '@team-chat/shared';
import { LIMITS, extractMentionHandles, toPlainPreview } from '@team-chat/shared';
import { badRequest, forbidden, notFound } from '../../../lib/errors';
import type { EventBus } from '../../../lib/eventBus';
import { sanitizeText } from '../../../lib/sanitize';
import type { ConversationRecord, ConversationsService } from '../../conversations';
import { canManage, isMember } from '../../conversations';
import type { UserRecord, UsersService } from '../../users';
import {
  assertCanEdit,
  assertContent,
  canDelete,
  isValidEmoji,
  toMessage,
  type MessageRecord,
} from '../domain/message';
import type { AttachmentPort, MessageRepository, ReadPointerPort } from './ports';

export class MessagesService {
  constructor(
    private readonly repo: MessageRepository,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    private readonly attachments: AttachmentPort,
    private readonly readPointers: () => ReadPointerPort,
    private readonly bus: EventBus,
  ) {}

  // ---- send ------------------------------------------------------------------------------

  async send(user: UserRecord, body: SendMessageBody): Promise<Message> {
    const conv = await this.conversations.requireMember(body.conversationId, user.id);

    // Idempotency: the same clientMsgId from the same author returns the stored message.
    const existing = await this.repo.findByClientMsgId(conv.id, user.id, body.clientMsgId);
    if (existing) return toMessage(existing);

    const text = sanitizeText(body.text, LIMITS.messageMaxLength);
    assertContent(text, body.attachmentIds.length);

    let rootId: string | undefined;
    if (body.threadRootId) {
      const root = await this.repo.findById(body.threadRootId);
      if (!root || root.conversationId !== conv.id) throw notFound('Thread not found');
      if (root.threadRootId) throw badRequest('Replies cannot be nested');
      if (root.deletedAt) throw badRequest('Cannot reply to a deleted message');
      rootId = root.id;
    }

    const attachments = await this.attachments.resolveForSend(user.id, [
      ...new Set(body.attachmentIds),
    ]);
    const { mentions, mentionsAll } = await this.resolveMentions(text, conv);

    let record: MessageRecord;
    try {
      record = await this.repo.insert({
        conversationId: conv.id,
        authorId: user.id,
        text,
        attachments,
        mentions,
        mentionsAll,
        ...(rootId ? { threadRootId: rootId } : {}),
        clientMsgId: body.clientMsgId,
      });
    } catch (e) {
      if (isDuplicateKey(e)) {
        const dup = await this.repo.findByClientMsgId(conv.id, user.id, body.clientMsgId);
        if (dup) return toMessage(dup);
      }
      throw e;
    }

    if (attachments.length > 0) {
      await this.attachments.markAttached(
        attachments.map((a) => a.fileId),
        conv.id,
        record.id,
      );
    }

    if (rootId) {
      const stats = await this.repo.registerReply(rootId, record.createdAt);
      if (stats) {
        this.bus.publish('thread.updated', {
          conversationId: conv.id,
          rootId,
          replyCount: stats.replyCount,
          lastReplyAt: stats.lastReplyAt.toISOString(),
        });
      }
    } else {
      await this.conversations.touch(conv.id, {
        id: record.id,
        authorId: user.id,
        text: toPlainPreview(text || attachments[0]?.name || 'Attachment', 140),
        createdAt: record.createdAt,
      });
      // Sending implies the author has seen everything up to their own message.
      await this.readPointers().markReadSilently(user.id, conv.id, record.id);
    }

    const message = toMessage(record);
    this.bus.publish('message.created', { message });
    return message;
  }

  // ---- queries ---------------------------------------------------------------------------

  async history(userId: string, conversationId: string, q: HistoryQuery): Promise<HistoryResponse> {
    await this.conversations.requireMember(conversationId, userId);
    const page = await this.repo.history(conversationId, {
      limit: q.limit,
      ...(q.beforeId ? { beforeId: q.beforeId } : {}),
      ...(q.afterId ? { afterId: q.afterId } : {}),
      ...(q.aroundId ? { aroundId: q.aroundId } : {}),
    });
    return {
      messages: page.messages.map(toMessage),
      hasMoreOlder: page.hasMoreOlder,
      hasMoreNewer: page.hasMoreNewer,
    };
  }

  async thread(userId: string, rootId: string): Promise<ThreadResponse> {
    const root = await this.requireMessage(rootId);
    await this.conversations.requireMember(root.conversationId, userId);
    if (root.threadRootId) throw badRequest('Not a thread root');
    const replies = await this.repo.replies(rootId, 500);
    return { root: toMessage(root), replies: replies.map(toMessage) };
  }

  async pins(userId: string, conversationId: string): Promise<Message[]> {
    await this.conversations.requireMember(conversationId, userId);
    return (await this.repo.pins(conversationId)).map(toMessage);
  }

  async search(userId: string, q: SearchQuery): Promise<SearchResponse> {
    const mine = await this.conversations.idsForUser(userId);
    let scope = mine;
    if (q.conversationId) {
      if (!mine.includes(q.conversationId))
        throw forbidden('You are not a member of this conversation');
      scope = [q.conversationId];
    }
    if (scope.length === 0) return { results: [], hasMore: false };
    const { results, hasMore } = await this.repo.search({
      text: q.q,
      conversationIds: scope,
      limit: q.limit,
      ...(q.authorId ? { authorId: q.authorId } : {}),
      ...(q.beforeId ? { beforeId: q.beforeId } : {}),
    });
    return { results: results.map(toMessage), hasMore };
  }

  countUnread: MessageRepository['countUnread'] = (userId, items) =>
    this.repo.countUnread(userId, items);

  /** Conversation a message belongs to (used to validate read pointers). */
  async conversationIdOf(messageId: string): Promise<string | null> {
    return (await this.repo.findById(messageId))?.conversationId ?? null;
  }

  // ---- mutations -------------------------------------------------------------------------

  async edit(user: UserRecord, messageId: string, rawText: string): Promise<Message> {
    const msg = await this.requireMessage(messageId);
    const conv = await this.conversations.requireMember(msg.conversationId, user.id);
    assertCanEdit(msg, user);
    const text = sanitizeText(rawText, LIMITS.messageMaxLength);
    if (!text && msg.attachments.length === 0) throw badRequest('Message is empty');
    const { mentions, mentionsAll } = await this.resolveMentions(text, conv);
    const updated = await this.repo.updateText(messageId, text, mentions, mentionsAll);
    if (!updated) throw notFound('Message not found');
    const message = toMessage(updated);
    this.bus.publish('message.updated', { message });
    return message;
  }

  async remove(user: UserRecord, messageId: string): Promise<Message> {
    const msg = await this.requireMessage(messageId);
    const conv = await this.conversations.requireMember(msg.conversationId, user.id);
    if (!canDelete(msg, user, canManage(conv, user)))
      throw forbidden('You cannot delete this message');
    if (msg.deletedAt) return toMessage(msg);
    const updated = await this.repo.softDelete(messageId);
    if (!updated) throw notFound('Message not found');
    const message = toMessage(updated);
    this.bus.publish('message.updated', { message });
    return message;
  }

  async toggleReaction(user: UserRecord, messageId: string, emoji: string): Promise<Reaction[]> {
    if (!isValidEmoji(emoji)) throw badRequest('Invalid emoji');
    const msg = await this.requireMessage(messageId);
    await this.conversations.requireMember(msg.conversationId, user.id);
    if (msg.deletedAt) throw badRequest('Message was deleted');
    const reactions = await this.repo.toggleReaction(
      messageId,
      user.id,
      emoji,
      LIMITS.maxReactionsPerMessage,
    );
    if (!reactions) throw badRequest('Too many different reactions on this message');
    this.bus.publish('reaction.updated', {
      conversationId: msg.conversationId,
      messageId,
      reactions,
    });
    return reactions;
  }

  async setPinned(user: UserRecord, messageId: string, pinned: boolean): Promise<Message> {
    const msg = await this.requireMessage(messageId);
    await this.conversations.requireMember(msg.conversationId, user.id);
    if (msg.deletedAt) throw badRequest('Message was deleted');
    if (msg.threadRootId) throw badRequest('Only top-level messages can be pinned');
    const updated = await this.repo.setPinned(messageId, pinned);
    if (!updated) throw notFound('Message not found');
    const message = toMessage(updated);
    this.bus.publish('message.updated', { message });
    return message;
  }

  // ---- helpers ---------------------------------------------------------------------------

  private async requireMessage(id: string): Promise<MessageRecord> {
    const m = await this.repo.findById(id);
    if (!m) throw notFound('Message not found');
    return m;
  }

  /** `@handle` → user ids of conversation members; `@channel` → everyone (channels only). */
  private async resolveMentions(
    text: string,
    conv: ConversationRecord,
  ): Promise<{ mentions: string[]; mentionsAll: boolean }> {
    const handles = extractMentionHandles(text);
    if (handles.length === 0) return { mentions: [], mentionsAll: false };
    const mentionsAll = conv.type === 'channel' && handles.includes('channel');
    const found = await this.users.findByHandles(
      handles.filter((h) => h !== 'channel').slice(0, 20),
    );
    const mentions = found.filter((u) => isMember(conv, u.id)).map((u) => u.id);
    return { mentions, mentionsAll };
  }
}

function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}
