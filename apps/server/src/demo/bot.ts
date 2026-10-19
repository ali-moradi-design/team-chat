import { randomUUID } from 'node:crypto';
import type { Container } from '../container';
import type { Logger } from '../lib/logger';
import { BOT, BOT_LINES, BOT_REPLIES } from './content';

const isPersian = (s: string) => /[؀-ۿ]/.test(s);
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;
const POST_IN = ['general', 'random', 'design-team'];

/** Demo bot: posts a tip now and then and answers when mentioned or messaged directly. */
export async function startBot(c: Container, logger: Logger): Promise<() => void> {
  const [bot] = await c.users.findByHandles([BOT.handle]);
  if (!bot) {
    logger.warn('demo bot user not found (run the seed first)');
    return () => undefined;
  }

  const send = (conversationId: string, text: string, threadRootId?: string) =>
    c.messages
      .send(bot, {
        conversationId,
        clientMsgId: randomUUID(),
        text,
        attachmentIds: [],
        ...(threadRootId ? { threadRootId } : {}),
      })
      .catch((err) => logger.warn({ err }, 'bot send failed'));

  const unsubscribe = c.bus.subscribe('message.created', ({ message }) => {
    if (message.authorId === bot.id) return;
    void (async () => {
      const conv = await c.conversations
        .requireMember(message.conversationId, bot.id)
        .catch(() => null);
      if (!conv) return;
      const addressed =
        message.mentions.includes(bot.id) || (conv.type === 'dm' && conv.members.length === 2);
      if (!addressed) return;
      const lang = isPersian(message.text) ? 'fa' : 'en';
      setTimeout(() => void send(conv.id, pick(BOT_REPLIES[lang]), message.threadRootId), 900);
    })();
  });

  const timer = setInterval(
    () => {
      void (async () => {
        const mine = await c.conversations.list(bot.id);
        const targets = mine.filter(
          (s) => s.type === 'channel' && s.name && POST_IN.includes(s.name),
        );
        const target = pick(targets);
        if (!target) return;
        const lang = Math.random() < 0.25 ? 'fa' : 'en';
        await send(target.id, pick(BOT_LINES[lang]));
      })();
    },
    (90 + Math.floor(Math.random() * 60)) * 1000,
  );
  timer.unref();

  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
