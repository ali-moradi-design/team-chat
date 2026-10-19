/**
 * Inserts N back-dated messages into a channel (performance / scroll testing).
 * Usage: MONGODB_URI=... tsx src/scripts/bulk.ts <channelName> <count>
 */
import { randomBytes } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { loadConfig } from '../config/env';
import { connectDb, disconnectDb } from '../db/connect';
import { createLogger } from '../lib/logger';
import { ConversationModel } from '../modules/conversations';
import { MessageModel } from '../modules/messages';
import { UserModel } from '../modules/users';

const [name = 'random', countArg = '3000'] = process.argv.slice(2);
const count = Number(countArg);
const config = loadConfig();
const logger = createLogger(config);
await connectDb(config, logger);

const conv = await ConversationModel.findOne({
  type: 'channel',
  nameKey: name.toLowerCase(),
}).lean();
if (!conv) throw new Error(`channel ${name} not found`);
const authors = await UserModel.find({ isBot: false }).select('_id').lean();
const words =
  'launch design review deploy bug fix queue socket mongo index latency cache release rollback metrics شاخص پیام کانال سرور تست'.split(
    ' ',
  );
const rand = (n: number) => Math.floor(Math.random() * n);
const sentence = () =>
  Array.from({ length: 4 + rand(18) }, () => words[rand(words.length)]).join(' ');

const now = Date.now();
const docs = Array.from({ length: count }, (_, i) => {
  const at = new Date(now - (count - i) * 90_000);
  return {
    _id: new Types.ObjectId(
      Math.floor(at.getTime() / 1000)
        .toString(16)
        .padStart(8, '0') + randomBytes(8).toString('hex'),
    ),
    conversationId: conv._id,
    authorId: authors[rand(authors.length)]!._id,
    text: i % 37 === 0 ? `**${sentence()}**\n${sentence()}` : sentence(),
    createdAt: at,
  };
});
for (let i = 0; i < docs.length; i += 1000)
  await MessageModel.insertMany(docs.slice(i, i + 1000), { ordered: false });
const last = docs[docs.length - 1]!;
await ConversationModel.updateOne(
  { _id: conv._id },
  {
    $set: {
      lastMessageAt: last.createdAt,
      lastMessage: {
        id: last._id,
        authorId: last.authorId,
        text: String(last.text).slice(0, 100),
        createdAt: last.createdAt,
      },
    },
  },
);
logger.info({ count, channel: name }, 'bulk messages inserted');
await disconnectDb();
await mongoose.disconnect();
