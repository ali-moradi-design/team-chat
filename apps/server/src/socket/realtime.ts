import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ZodType } from 'zod';
import {
  deleteMessageBody,
  editMessageBody,
  objectId,
  pinMessageBody,
  sendMessageBody,
  toggleReactionBody,
  type Ack,
  type ClientToServerEvents,
  type PresenceStatus,
  type ServerToClientEvents,
  type SocketData,
} from '@team-chat/shared';
import { z } from 'zod';
import type { Config } from '../config/env';
import { AppError, badRequest, forbidden } from '../lib/errors';
import type { EventBus } from '../lib/eventBus';
import type { Logger } from '../lib/logger';
import { RateLimiter } from '../lib/rateLimit';
import { toMe, type AuthService } from '../modules/auth';
import type { ConversationsService } from '../modules/conversations';
import type { MessagesService } from '../modules/messages';
import type { ReadStatesService } from '../modules/read-states';
import type { UserRecord, UsersService } from '../modules/users';

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
> & {
  data: SocketData & { user?: UserRecord };
};

export interface RealtimeDeps {
  config: Config;
  logger: Logger;
  bus: EventBus;
  auth: AuthService;
  users: UsersService;
  conversations: ConversationsService;
  messages: MessagesService;
  readStates: ReadStatesService;
}

export interface Realtime {
  io: IoServer;
  close(): Promise<void>;
}

const userRoom = (id: string) => `user:${id}`;
const convRoom = (id: string) => `conv:${id}`;
const OFFLINE_GRACE_MS = 3000;

const toAckError = (e: unknown, logger: Logger): Ack<never> & { ok: false } => {
  if (e instanceof AppError) return { ok: false, error: e.toJSON() };
  logger.error({ err: e }, 'socket handler failed');
  return { ok: false, error: { code: 'internal', message: 'Something went wrong' } };
};

export async function createRealtime(
  httpServer: HttpServer,
  deps: RealtimeDeps,
): Promise<Realtime> {
  const { config, logger, bus } = deps;
  const origins = new Set(config.corsOrigins);

  const io: IoServer = new Server(httpServer, {
    serveClient: false,
    cors: { origin: config.corsOrigins, credentials: true },
    // Browsers do not enforce CORS for the websocket transport, so verify Origin ourselves.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || origins.has(origin) || !config.isProd);
    },
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    perMessageDeflate: false,
    transports: ['websocket', 'polling'],
  });

  let redisClients: Array<{ quit(): Promise<unknown> }> = [];
  if (config.redisUrl) {
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('redis'),
    ]);
    const pub = createClient({ url: config.redisUrl });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    redisClients = [pub, sub];
    logger.info('socket.io redis adapter enabled');
  }

  // ---- presence (derived from sockets, so it works with several instances) ---------------------

  const lastBroadcast = new Map<string, PresenceStatus>();

  async function statusOf(userId: string): Promise<PresenceStatus> {
    const sockets = await io.in(userRoom(userId)).fetchSockets();
    if (sockets.length === 0) return 'offline';
    return sockets.some((s) => s.data.status === 'online') ? 'online' : 'away';
  }

  async function refreshPresence(userId: string): Promise<void> {
    const status = await statusOf(userId);
    if ((lastBroadcast.get(userId) ?? 'offline') === status) return;
    if (status === 'offline') lastBroadcast.delete(userId);
    else lastBroadcast.set(userId, status);
    io.emit('presence:update', { userId, status });
  }

  async function presenceSnapshot(): Promise<Record<string, PresenceStatus>> {
    const out: Record<string, PresenceStatus> = {};
    for (const s of await io.fetchSockets()) {
      const id = s.data.userId;
      if (s.data.status === 'online') out[id] = 'online';
      else out[id] ??= 'away';
    }
    return out;
  }

  // ---- auth -----------------------------------------------------------------------------------------

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== 'string' || token.length === 0)
        throw new AppError('unauthorized', 'Missing token');
      const user = await deps.auth.authenticate(token);
      (socket as IoSocket).data.user = user;
      socket.data.userId = user.id;
      socket.data.status = 'online';
      next();
    } catch (e) {
      next(
        e instanceof AppError
          ? Object.assign(new Error(e.message), { data: e.toJSON() })
          : new Error('unauthorized'),
      );
    }
  });

  // ---- per-socket rate limits -------------------------------------------------------------------

  const limits = {
    send: new RateLimiter(3, 8),
    mutate: new RateLimiter(5, 15),
    react: new RateLimiter(8, 20),
    typing: new RateLimiter(2, 4),
    read: new RateLimiter(5, 10),
  };
  const clearLimits = (id: string) => Object.values(limits).forEach((l) => l.remove(id));

  /** Validates payload + rate limit + authorization, then runs `fn`. Always acks. */
  function handle<S extends ZodType, R>(
    socket: IoSocket,
    schema: S,
    limiter: RateLimiter,
    fn: (input: z.infer<S>, user: UserRecord) => Promise<R>,
    getConversationId?: (input: z.infer<S>) => string | undefined,
  ) {
    return async (raw: unknown, ack?: (res: Ack<R>) => void) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      try {
        if (!limiter.tryConsume(socket.id)) throw new AppError('rate_limited', 'Slow down');
        const parsed = schema.safeParse(raw);
        if (!parsed.success) throw badRequest('Invalid payload');
        const cid = getConversationId?.(parsed.data);
        // Cheap per-event authorization: rooms mirror membership.
        if (cid && !socket.rooms.has(convRoom(cid)))
          throw forbidden('You are not a member of this conversation');
        const user = socket.data.user!;
        const data = await fn(parsed.data, user);
        reply({ ok: true, data } as unknown as Ack<R>);
      } catch (e) {
        reply(toAckError(e, logger) as unknown as Ack<R>);
      }
    };
  }

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as IoSocket;
    const user = socket.data.user!;
    try {
      await socket.join(userRoom(user.id));
      const ids = await deps.conversations.idsForUser(user.id);
      await socket.join(ids.map(convRoom));
      const presence = await presenceSnapshot();
      presence[user.id] = 'online';
      socket.emit('ready', { me: toMe(user), presence });
      void refreshPresence(user.id);
    } catch (e) {
      logger.error({ err: e }, 'socket init failed');
      socket.disconnect(true);
      return;
    }

    socket.on(
      'message:send',
      handle(
        socket,
        sendMessageBody,
        limits.send,
        (body, u) => deps.messages.send(u, body).then((message) => ({ message })),
        (b) => b.conversationId,
      ),
    );
    socket.on(
      'message:edit',
      handle(socket, editMessageBody, limits.mutate, (b, u) =>
        deps.messages.edit(u, b.messageId, b.text).then((message) => ({ message })),
      ),
    );
    socket.on(
      'message:delete',
      handle(socket, deleteMessageBody, limits.mutate, async (b, u) => {
        const fresh = (await deps.users.findById(u.id)) ?? u; // role may have changed since connect
        return { message: await deps.messages.remove(fresh, b.messageId) };
      }),
    );
    socket.on(
      'message:pin',
      handle(socket, pinMessageBody, limits.mutate, (b, u) =>
        deps.messages.setPinned(u, b.messageId, b.pinned).then((message) => ({ message })),
      ),
    );
    socket.on(
      'reaction:toggle',
      handle(socket, toggleReactionBody, limits.react, (b, u) =>
        deps.messages.toggleReaction(u, b.messageId, b.emoji).then((reactions) => ({ reactions })),
      ),
    );
    socket.on(
      'read:update',
      handle(
        socket,
        z.object({ conversationId: objectId, messageId: objectId }),
        limits.read,
        async (b, u) => {
          await deps.readStates.markRead(u.id, b.conversationId, b.messageId);
        },
        (b) => b.conversationId,
      ),
    );

    socket.on('typing', (raw) => {
      const p = z.object({ conversationId: objectId, isTyping: z.boolean() }).safeParse(raw);
      if (!p.success || !limits.typing.tryConsume(socket.id)) return;
      if (!socket.rooms.has(convRoom(p.data.conversationId))) return;
      // Volatile: a dropped typing packet is harmless and must never queue up.
      socket.to(convRoom(p.data.conversationId)).volatile.emit('typing', {
        conversationId: p.data.conversationId,
        userId: user.id,
        isTyping: p.data.isTyping,
      });
    });

    socket.on('presence:set', (raw) => {
      const p = z.object({ status: z.enum(['online', 'away']) }).safeParse(raw);
      if (!p.success) return;
      socket.data.status = p.data.status;
      void refreshPresence(user.id);
    });

    socket.on('disconnect', () => {
      clearLimits(socket.id);
      // Grace period so a page reload does not flash "offline".
      setTimeout(() => void refreshPresence(user.id), OFFLINE_GRACE_MS).unref();
    });
  });

  // ---- domain events → sockets ---------------------------------------------------------------------

  const joinAndPush = async (
    summaries: Array<{ userId: string; summary: { id: string } & Record<string, unknown> }>,
  ) => {
    for (const { userId, summary } of summaries) {
      await io.in(userRoom(userId)).socketsJoin(convRoom(summary.id));
      io.to(userRoom(userId)).emit('conversation:upsert', { conversation: summary as never });
    }
  };

  const unsub = [
    bus.subscribe('message.created', ({ message }) => {
      io.to(convRoom(message.conversationId)).emit('message:new', { message });
    }),
    bus.subscribe('message.updated', ({ message }) => {
      io.to(convRoom(message.conversationId)).emit('message:updated', { message });
    }),
    bus.subscribe('reaction.updated', (p) => {
      io.to(convRoom(p.conversationId)).emit('reaction:updated', p);
    }),
    bus.subscribe('thread.updated', (p) => {
      io.to(convRoom(p.conversationId)).emit('thread:updated', p);
    }),
    bus.subscribe('conversation.created', ({ summaries }) => void joinAndPush(summaries)),
    bus.subscribe('conversation.members-added', ({ summaries }) => void joinAndPush(summaries)),
    bus.subscribe('conversation.updated', ({ conversation }) => {
      io.to(convRoom(conversation.id)).emit('conversation:updated', { conversation });
    }),
    bus.subscribe('conversation.member-removed', ({ conversationId, userId }) => {
      io.to(userRoom(userId)).emit('conversation:removed', { conversationId });
      void io.in(userRoom(userId)).socketsLeave(convRoom(conversationId));
    }),
    bus.subscribe('read.updated', ({ conversationId, userId, messageId, notify }) => {
      io.to(notify.map(userRoom)).emit('read:updated', { conversationId, userId, messageId });
    }),
    bus.subscribe('user.updated', ({ user }) => {
      io.emit('user:upsert', { user });
    }),
  ];

  return {
    io,
    async close() {
      unsub.forEach((u) => u());
      await io.close();
      await Promise.all(redisClients.map((c) => c.quit().catch(() => undefined)));
    },
  };
}
