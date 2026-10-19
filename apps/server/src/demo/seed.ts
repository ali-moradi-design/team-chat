import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import mongoose, { Types } from 'mongoose';
import type { Logger } from '../lib/logger';
import type { Container } from '../container';
import { ConversationModel } from '../modules/conversations';
import { dmKey } from '../modules/conversations/domain/conversation';
import { FileModel } from '../modules/files';
import { MessageModel } from '../modules/messages';
import { ReadStateModel } from '../modules/read-states';
import { UserModel } from '../modules/users';
import { BOT, DEMO_CHANNELS, DEMO_DMS, DEMO_PASSWORD, DEMO_USERS } from './content';

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
/** ObjectId whose embedded timestamp is `d` (so history ordering and "time ago" match). */
const idAt = (d: Date) =>
  new Types.ObjectId(
    Math.floor(d.getTime() / 1000)
      .toString(16)
      .padStart(8, '0') + randomBytes(8).toString('hex'),
  );

/** Creates the demo workspace in an empty database. Safe to call once after `resetDatabase`. */
export async function seedDemo(c: Container, logger: Logger): Promise<void> {
  const ids = new Map<string, string>();

  for (const u of DEMO_USERS) {
    const s = await c.auth.service.register({
      name: u.name,
      handle: u.handle,
      email: `${u.handle}@demo.dev`,
      password: DEMO_PASSWORD,
    });
    ids.set(u.handle, s.user.id);
  }
  const bot = await c.users.create({
    name: BOT.name,
    handle: BOT.handle,
    email: 'echo@bot.local',
    passwordHash: await argon2.hash(randomBytes(16).toString('hex'), {
      type: argon2.argon2id,
      memoryCost: 1024,
      timeCost: 2,
    }),
    isBot: true,
  });
  ids.set(BOT.handle, bot.id);
  const id = (h: string) => ids.get(h)!;

  type Seeded = { convId: string; members: string[]; lastId?: Types.ObjectId };
  const seeded: Seeded[] = [];

  const insertMessages = async (
    convId: string,
    list: Array<{
      by: string;
      text: string;
      minutesAgo: number;
      reactions?: Array<[string, string[]]>;
      pinned?: boolean;
      replies?: Array<{ by: string; text: string; minutesAfter: number }>;
    }>,
  ): Promise<Types.ObjectId | undefined> => {
    let last: Types.ObjectId | undefined;
    const docs: Array<Record<string, unknown>> = [];
    for (const m of list.sort((a, b) => b.minutesAgo - a.minutesAgo)) {
      const created = at(m.minutesAgo);
      const _id = idAt(created);
      last = _id;
      const mentions = [...m.text.matchAll(/@([a-z0-9_]+)/g)]
        .map((x) => ids.get(x[1]!))
        .filter(Boolean) as string[];
      docs.push({
        _id,
        conversationId: new Types.ObjectId(convId),
        authorId: new Types.ObjectId(id(m.by)),
        text: m.text,
        reactions: (m.reactions ?? []).map(([emoji, by]) => ({
          emoji,
          userIds: by.map((h) => new Types.ObjectId(id(h))),
        })),
        mentions: mentions.map((x) => new Types.ObjectId(x)),
        mentionsAll: /@channel\b/.test(m.text.replace(/`[^`]*`/g, '')),
        pinned: !!m.pinned,
        ...(m.pinned ? { pinnedAt: created } : {}),
        replyCount: m.replies?.length ?? 0,
        ...(m.replies?.length
          ? { lastReplyAt: new Date(created.getTime() + m.replies.at(-1)!.minutesAfter * 60_000) }
          : {}),
        createdAt: created,
      });
      for (const r of m.replies ?? []) {
        const rc = new Date(created.getTime() + r.minutesAfter * 60_000);
        docs.push({
          _id: idAt(rc),
          conversationId: new Types.ObjectId(convId),
          authorId: new Types.ObjectId(id(r.by)),
          text: r.text,
          threadRootId: _id,
          createdAt: rc,
        });
      }
    }
    await MessageModel.insertMany(docs, { ordered: true });
    const tops = docs.filter((d) => !d.threadRootId);
    const lastTop = tops.at(-1);
    if (lastTop) {
      await ConversationModel.updateOne(
        { _id: convId },
        {
          $set: {
            lastMessageAt: lastTop.createdAt,
            lastMessage: {
              id: lastTop._id,
              authorId: lastTop.authorId,
              text: String(lastTop.text).replace(/[*`]/g, '').split('\n')[0]!.slice(0, 140),
              createdAt: lastTop.createdAt,
            },
          },
        },
      );
    }
    return last;
  };

  for (const ch of DEMO_CHANNELS) {
    let conv = await ConversationModel.findOne({ type: 'channel', nameKey: ch.name }).lean();
    if (!conv) {
      const created = await ConversationModel.create({
        type: 'channel',
        name: ch.name,
        nameKey: ch.name,
        topic: ch.topic,
        isPrivate: !!ch.isPrivate,
        members: ch.members.map((h, i) => ({
          userId: new Types.ObjectId(id(h)),
          role: i === 0 ? 'owner' : 'member',
        })),
        createdBy: new Types.ObjectId(id(ch.members[0]!)),
      });
      conv = created.toObject();
    } else {
      await ConversationModel.updateOne(
        { _id: conv._id },
        {
          $set: {
            topic: ch.topic,
            members: ch.members.map((h, i) => ({
              userId: new Types.ObjectId(id(h)),
              role: i === 0 ? 'owner' : 'member',
              joinedAt: new Date(),
            })),
          },
        },
      );
    }
    const convId = conv!._id.toString();
    const lastId = await insertMessages(convId, ch.messages);
    seeded.push({ convId, members: ch.members, ...(lastId ? { lastId } : {}) });
  }

  for (const dm of DEMO_DMS) {
    const memberIds = dm.with.map(id);
    const created = await ConversationModel.create({
      type: 'dm',
      dmKey: dmKey(memberIds),
      isPrivate: true,
      members: memberIds.map((m) => ({ userId: new Types.ObjectId(m), role: 'member' })),
      createdBy: new Types.ObjectId(memberIds[0]!),
    });
    const lastId = await insertMessages(created._id.toString(), dm.messages);
    seeded.push({
      convId: created._id.toString(),
      members: [...dm.with],
      ...(lastId ? { lastId } : {}),
    });
  }

  // Read pointers: everybody has read everything, except "ali" who has unread items in a few places,
  // so the demo shows badges and mentions immediately.
  const unreadForAli = new Set(['design-team', 'engineering', 'launch-2026']);
  const names = new Map(
    (await ConversationModel.find({ type: 'channel' }).select('name').lean()).map((c) => [
      c._id.toString(),
      c.name,
    ]),
  );
  const reads: Array<Record<string, unknown>> = [];
  for (const s of seeded) {
    for (const h of s.members) {
      const unread = h === 'ali' && unreadForAli.has(names.get(s.convId) ?? '');
      reads.push({
        userId: new Types.ObjectId(id(h)),
        conversationId: new Types.ObjectId(s.convId),
        ...(s.lastId && !unread ? { lastReadMessageId: s.lastId } : {}),
        muted: h === 'ali' && names.get(s.convId) === 'random',
      });
    }
  }
  await ReadStateModel.deleteMany({
    conversationId: { $in: seeded.map((s) => new Types.ObjectId(s.convId)) },
  });
  await ReadStateModel.insertMany(reads);
  // "ali" has read the first messages of the unread channels, so only the latest ones are unread.
  for (const s of seeded) {
    if (!unreadForAli.has(names.get(s.convId) ?? '')) continue;
    const early = await MessageModel.find({ conversationId: s.convId, threadRootId: null })
      .sort({ _id: 1 })
      .limit(2)
      .select('_id')
      .lean();
    const pointer = early.at(-1)?._id;
    if (pointer)
      await ReadStateModel.updateOne(
        { userId: id('ali'), conversationId: s.convId },
        { $set: { lastReadMessageId: pointer } },
      );
  }

  logger.info(
    { users: DEMO_USERS.length + 1, channels: DEMO_CHANNELS.length, dms: DEMO_DMS.length },
    'demo data seeded',
  );
}

export async function resetDatabase(): Promise<void> {
  await Promise.all([
    UserModel.deleteMany({}),
    ConversationModel.deleteMany({}),
    MessageModel.deleteMany({}),
    ReadStateModel.deleteMany({}),
    FileModel.deleteMany({}),
    mongoose.connection.collection('refreshtokens').deleteMany({}),
  ]);
}
