import { Types } from 'mongoose';
import type { ReadStateRepository } from '../application/ports';
import { ReadStateModel, type ReadStateDoc } from './readState.model';

const oid = (id: string) => new Types.ObjectId(id);

export class MongoReadStateRepository implements ReadStateRepository {
  async getMany(userId: string, conversationIds: string[]) {
    const docs = await ReadStateModel.find({
      userId: oid(userId),
      conversationId: { $in: conversationIds.map(oid) },
    })
      .select('conversationId lastReadMessageId muted')
      .lean<ReadStateDoc[]>();
    const out = new Map<string, { lastReadMessageId?: string; muted: boolean }>();
    for (const d of docs) {
      out.set(d.conversationId.toString(), {
        muted: d.muted,
        ...(d.lastReadMessageId ? { lastReadMessageId: d.lastReadMessageId.toString() } : {}),
      });
    }
    return out;
  }

  async pointersFor(conversationId: string, userIds: string[]) {
    const docs = await ReadStateModel.find({
      conversationId: oid(conversationId),
      userId: { $in: userIds.map(oid) },
    })
      .select('userId lastReadMessageId')
      .lean<ReadStateDoc[]>();
    const out: Record<string, string> = {};
    for (const d of docs)
      if (d.lastReadMessageId) out[d.userId.toString()] = d.lastReadMessageId.toString();
    return out;
  }

  async upsertInitial(userId: string, conversationId: string, lastReadMessageId?: string) {
    await ReadStateModel.updateOne(
      { userId: oid(userId), conversationId: oid(conversationId) },
      {
        $setOnInsert: {
          muted: false,
          ...(lastReadMessageId ? { lastReadMessageId: oid(lastReadMessageId) } : {}),
        },
      },
      { upsert: true },
    );
  }

  async advance(userId: string, conversationId: string, messageId: string) {
    // $max keeps the pointer monotonic even with concurrent tabs / out-of-order acks.
    await ReadStateModel.updateOne(
      { userId: oid(userId), conversationId: oid(conversationId) },
      { $max: { lastReadMessageId: oid(messageId) }, $setOnInsert: { muted: false } },
      { upsert: true },
    );
  }

  async setMuted(userId: string, conversationId: string, muted: boolean) {
    await ReadStateModel.updateOne(
      { userId: oid(userId), conversationId: oid(conversationId) },
      { $set: { muted } },
      { upsert: true },
    );
  }

  async remove(userId: string, conversationId: string) {
    await ReadStateModel.deleteOne({ userId: oid(userId), conversationId: oid(conversationId) });
  }
}
