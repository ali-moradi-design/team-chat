import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { io as connect, type Socket } from 'socket.io-client';
import type { Ack, Message } from '@team-chat/shared';
import { loadConfig } from '../src/config/env';
import { connectDb, disconnectDb, syncIndexes } from '../src/db/connect';
import { createLogger } from '../src/lib/logger';
import { startServer, type RunningServer } from '../src/server';

export interface TestApp {
  server: RunningServer;
  url: string;
  uploadDir: string;
  stop(): Promise<void>;
  http<T = any>(
    path: string,
    init?: {
      method?: string;
      body?: unknown;
      token?: string;
      cookie?: string;
      headers?: Record<string, string>;
    },
  ): Promise<{ status: number; body: T; cookies: string[] }>;
  signUp(name: string, handle?: string): Promise<TestUser>;
  socket(token: string): Promise<Socket>;
}

export interface TestUser {
  id: string;
  token: string;
  handle: string;
  cookie: string;
  email: string;
  password: string;
}

const MONGO = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';

export async function startTestApp(): Promise<TestApp> {
  const dbName = `team-chat-test-${randomUUID().slice(0, 8)}`;
  const uploadDir = mkdtempSync(join(tmpdir(), 'team-chat-uploads-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    MONGODB_URI: `${MONGO}/${dbName}`,
    UPLOAD_DIR: uploadDir,
    JWT_SECRET: 'test-secret-test-secret-test-secret',
    CORS_ORIGINS: 'http://localhost:5173',
  } as NodeJS.ProcessEnv);
  const logger = createLogger(config);
  await connectDb(config, logger);
  await syncIndexes();
  const server = await startServer(config, logger);
  const url = `http://127.0.0.1:${server.port}`;
  const sockets: Socket[] = [];

  const http: TestApp['http'] = async (path, init = {}) => {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    if (init.token) headers.authorization = `Bearer ${init.token}`;
    if (init.cookie) headers.cookie = init.cookie;
    let body: string | FormData | undefined;
    if (init.body instanceof FormData) body = init.body;
    else if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(init.body);
    }
    const res = await fetch(`${url}${path}`, {
      method: init.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      /* binary or text */
    }
    return { status: res.status, body: parsed as never, cookies: res.headers.getSetCookie() };
  };

  const app: TestApp = {
    server,
    url,
    uploadDir,
    http,
    async signUp(name, handle = name.toLowerCase().replace(/\W/g, '_')) {
      const email = `${handle}@example.com`;
      const password = 'correct-horse-battery';
      const res = await http('/api/auth/register', { body: { name, handle, email, password } });
      if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
      const cookie = res.cookies.map((c) => c.split(';')[0]).join('; ');
      return { id: res.body.user.id, token: res.body.accessToken, handle, cookie, email, password };
    },
    async socket(token) {
      const s = connect(url, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      sockets.push(s);
      await new Promise<void>((resolve, reject) => {
        s.once('ready', () => resolve());
        s.once('connect_error', reject);
      });
      return s;
    },
    async stop() {
      sockets.forEach((s) => s.disconnect());
      await server.close();
      await mongoose.connection.dropDatabase();
      await disconnectDb();
      rmSync(uploadDir, { recursive: true, force: true });
    },
  };
  return app;
}

export function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), 5000);
    socket.emit(event, payload, (res: Ack<T>) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

export function waitFor<T = any>(
  socket: Socket,
  event: string,
  predicate: (p: T) => boolean = () => true,
  ms = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, ms);
    const handler = (p: T) => {
      if (predicate(p)) {
        clearTimeout(t);
        socket.off(event, handler);
        resolve(p);
      }
    };
    socket.on(event, handler);
  });
}

export const cid = () => randomUUID();

export async function sendMsg(
  socket: Socket,
  conversationId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<Message> {
  const clientMsgId = cid();
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await emitAck<{ message: Message }>(socket, 'message:send', {
      conversationId,
      clientMsgId,
      text,
      attachmentIds: [],
      ...extra,
    });
    if (res.ok) return res.data.message;
    if (res.error.code !== 'rate_limited')
      throw new Error(`send failed: ${JSON.stringify(res.error)}`);
    await new Promise((r) => setTimeout(r, 150)); // same clientMsgId: retry is idempotent
  }
  throw new Error('send kept being rate limited');
}
