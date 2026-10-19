import { Types, type QueryFilter } from 'mongoose';
import type { Reaction } from '@team-chat/shared';
import type {
  HistoryPage,
  HistoryParams,
  MessageRepository,
  NewMessage,
} from '../application/ports';
import type { MessageRecord } from '../domain/message';
import { MessageModel, type MessageDoc } from './message.model';

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(d: MessageDoc): MessageRecord {
  return {
    id: d._id.toString(),
    conversationId: d.conversationId.toString(),
    authorId: d.authorId.toString(),
    text: d.text,
    attachments: (d.attachments ?? []).map((a) => ({
      fileId: a.fileId.toString(),
      name: a.name,
      mime: a.mime,
      size: a.size,
      kind: a.kind,
      ...(a.width ? { width: a.width } : {}),
      ...(a.height ? { height: a.height } : {}),
    })),
    reactions: (d.reactions ?? []).map((r) => ({
      emoji: r.emoji,
      userIds: r.userIds.map((u) => u.toString()),
    })),
    mentions: (d.mentions ?? []).map((m) => m.toString()),
    mentionsAll: d.mentionsAll ?? false,
    ...(d.threadRootId ? { threadRootId: d.threadRootId.toString() } : {}),
    replyCount: d.replyCount ?? 0,
    ...(d.lastReplyAt ? { lastReplyAt: d.lastReplyAt } : {}),
    pinned: d.pinned ?? false,
    ...(d.editedAt ? { editedAt: d.editedAt } : {}),
    ...(d.deletedAt ? { deletedAt: d.deletedAt } : {}),
    createdAt: d.createdAt,
    ...(d.clientMsgId ? { clientMsgId: d.clientMsgId } : {}),
  };
}

export class MongoMessageRepository implements MessageRepository {
  async insert(input: NewMessage): Promise<MessageRecord> {
    const doc = await MessageModel.create({
      conversationId: oid(input.conversationId),
      authorId: oid(input.authorId),
      text: input.text,
      attachments: input.attachments.map((a) => ({ ...a, fileId: oid(a.fileId) })),
      mentions: input.mentions.map(oid),
      mentionsAll: input.mentionsAll,
      ...(input.threadRootId ? { threadRootId: oid(input.threadRootId) } : {}),
      clientMsgId: input.clientMsgId,
    });
    return toRecord(doc.toObject());
  }

  async findById(id: string) {
    const d = await MessageModel.findById(id).lean<MessageDoc>();
    return d ? toRecord(d) : null;
  }

  async findByClientMsgId(conversationId: string, authorId: string, clientMsgId: string) {
    const d = await MessageModel.findOne({
      conversationId: oid(conversationId),
      authorId: oid(authorId),
      clientMsgId,
    }).lean<MessageDoc>();
    return d ? toRecord(d) : null;
  }

  async history(conversationId: string, p: HistoryParams): Promise<HistoryPage> {
    const base = {
      conversationId: oid(conversationId),
      threadRootId: null,
    } as QueryFilter<MessageDoc>;
    const q = (extra: QueryFilter<MessageDoc>, sort: 1 | -1, limit: number) =>
      MessageModel.find({ ...base, ...extra })
        .sort({ _id: sort })
        .limit(limit)
        .lean<MessageDoc[]>();

    if (p.afterId) {
      const docs = await q({ _id: { $gt: oid(p.afterId) } }, 1, p.limit + 1);
      return {
        messages: docs.slice(0, p.limit).map(toRecord),
        hasMoreOlder: true,
        hasMoreNewer: docs.length > p.limit,
      };
    }

    if (p.aroundId) {
      const half = Math.max(1, Math.floor(p.limit / 2));
      const [older, newer] = await Promise.all([
        q({ _id: { $lte: oid(p.aroundId) } }, -1, half + 1),
        q({ _id: { $gt: oid(p.aroundId) } }, 1, half + 1),
      ]);
      return {
        messages: [...older.slice(0, half).reverse(), ...newer.slice(0, half)].map(toRecord),
        hasMoreOlder: older.length > half,
        hasMoreNewer: newer.length > half,
      };
    }

    const docs = await q(p.beforeId ? { _id: { $lt: oid(p.beforeId) } } : {}, -1, p.limit + 1);
    return {
      messages: docs.slice(0, p.limit).reverse().map(toRecord),
      hasMoreOlder: docs.length > p.limit,
      hasMoreNewer: false,
    };
  }

  async replies(rootId: string, limit: number) {
    const docs = await MessageModel.find({ threadRootId: oid(rootId) })
      .sort({ _id: 1 })
      .limit(limit)
      .lean<MessageDoc[]>();
    return docs.map(toRecord);
  }

  async pins(conversationId: string) {
    const docs = await MessageModel.find({
      conversationId: oid(conversationId),
      pinned: true,
      deletedAt: null,
    })
      .sort({ pinnedAt: -1 })
      .limit(100)
      .lean<MessageDoc[]>();
    return docs.map(toRecord);
  }

  async updateText(id: string, text: string, mentions: string[], mentionsAll: boolean) {
    const d = await MessageModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { text, mentions: mentions.map(oid), mentionsAll, editedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean<MessageDoc>();
    return d ? toRecord(d) : null;
  }

  async softDelete(id: string) {
    const d = await MessageModel.findByIdAndUpdate(
      id,
      {
        $set: {
          text: '',
          attachments: [],
          reactions: [],
          mentions: [],
          mentionsAll: false,
          pinned: false,
          deletedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    ).lean<MessageDoc>();
    return d ? toRecord(d) : null;
  }

  async toggleReaction(
    id: string,
    userId: string,
    emoji: string,
    maxEmojis: number,
  ): Promise<Reaction[] | null> {
    const uid = oid(userId);
    const _id = oid(id);

    // 1) already reacted → remove (and drop the emoji when nobody is left)
    const removed = await MessageModel.updateOne(
      { _id, reactions: { $elemMatch: { emoji, userIds: uid } } },
      { $pull: { 'reactions.$.userIds': uid } },
    );
    if (removed.modifiedCount > 0) {
      await MessageModel.updateOne(
        { _id },
        { $pull: { reactions: { emoji, userIds: { $size: 0 } } } },
      );
    } else {
      // 2) emoji exists → add me
      const added = await MessageModel.updateOne(
        { _id, 'reactions.emoji': emoji },
        { $addToSet: { 'reactions.$.userIds': uid } },
      );
      if (added.matchedCount === 0) {
        // 3) first use of this emoji on the message (guarded by a cap on distinct emoji)
        const pushed = await MessageModel.updateOne(
          {
            _id,
            'reactions.emoji': { $ne: emoji },
            [`reactions.${maxEmojis - 1}`]: { $exists: false },
          },
          { $push: { reactions: { emoji, userIds: [uid] } } },
        );
        if (pushed.modifiedCount === 0) {
          // lost a race (emoji now exists) or hit the cap
          const retry = await MessageModel.updateOne(
            { _id, 'reactions.emoji': emoji },
            { $addToSet: { 'reactions.$.userIds': uid } },
          );
          if (retry.matchedCount === 0) return null;
        }
      }
    }
    const d = await MessageModel.findById(_id)
      .select('reactions')
      .lean<Pick<MessageDoc, 'reactions'>>();
    if (!d) return null;
    return d.reactions.map((r) => ({
      emoji: r.emoji,
      userIds: r.userIds.map((u) => u.toString()),
    }));
  }

  async setPinned(id: string, pinned: boolean) {
    const d = await MessageModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      pinned
        ? { $set: { pinned: true, pinnedAt: new Date() } }
        : { $set: { pinned: false }, $unset: { pinnedAt: 1 } },
      { returnDocument: 'after' },
    ).lean<MessageDoc>();
    return d ? toRecord(d) : null;
  }

  async registerReply(rootId: string, at: Date) {
    const d = await MessageModel.findByIdAndUpdate(
      rootId,
      { $inc: { replyCount: 1 }, $max: { lastReplyAt: at } },
      { returnDocument: 'after' },
    )
      .select('replyCount lastReplyAt')
      .lean<Pick<MessageDoc, 'replyCount' | 'lastReplyAt'>>();
    return d ? { replyCount: d.replyCount, lastReplyAt: d.lastReplyAt ?? at } : null;
  }

  async search(p: {
    text: string;
    conversationIds: string[];
    authorId?: string;
    beforeId?: string;
    limit: number;
  }) {
    const filter: QueryFilter<MessageDoc> = {
      $text: { $search: p.text },
      conversationId: { $in: p.conversationIds.map(oid) },
      deletedAt: null,
      ...(p.authorId ? { authorId: oid(p.authorId) } : {}),
      ...(p.beforeId ? { _id: { $lt: oid(p.beforeId) } } : {}),
    };
    const docs = await MessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(p.limit + 1)
      .lean<MessageDoc[]>();
    return { results: docs.slice(0, p.limit).map(toRecord), hasMore: docs.length > p.limit };
  }

  async countUnread(
    userId: string,
    items: Array<{ conversationId: string; lastReadMessageId?: string }>,
  ) {
    const uid = oid(userId);
    const out = new Map<string, { unread: number; mentions: number }>();
    await Promise.all(
      items.map(async (item) => {
        const [row] = await MessageModel.aggregate<{ unread: number; mentions: number }>([
          {
            $match: {
              conversationId: oid(item.conversationId),
              threadRootId: null,
              ...(item.lastReadMessageId ? { _id: { $gt: oid(item.lastReadMessageId) } } : {}),
              authorId: { $ne: uid },
              deletedAt: null,
            },
          },
          { $limit: 100 },
          {
            $group: {
              _id: null,
              unread: { $sum: 1 },
              mentions: {
                $sum: { $cond: [{ $or: [{ $in: [uid, '$mentions'] }, '$mentionsAll'] }, 1, 0] },
              },
            },
          },
        ]);
        out.set(item.conversationId, { unread: row?.unread ?? 0, mentions: row?.mentions ?? 0 });
      }),
    );
    return out;
  }
}
