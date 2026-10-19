import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import type { Config } from './config/env';
import { AppError } from './lib/errors';
import type { Logger } from './lib/logger';
import type { Container } from './container';

export function createApp(config: Config, logger: Logger, c: Container): Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // The SPA is served from the same origin; sockets connect back to it.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Only force HTTPS when the deployment is actually served over TLS.
          upgradeInsecureRequests: config.cookieSecure ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    const ok = mongoose.connection.readyState === 1;
    res
      .status(ok ? 200 : 503)
      .json({ status: ok ? 'ok' : 'degraded', uptime: Math.round(process.uptime()) });
  });

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  if (!config.isTest) {
    api.use(
      rateLimit({
        windowMs: 60_000,
        limit: 600,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: { code: 'rate_limited', message: 'Too many requests' } },
      }),
    );
  }
  api.get('/config', (_req, res) => {
    res.json({ demo: config.demoMode });
  });
  api.use('/auth', c.auth.router);
  api.use('/users', c.usersRouter);
  api.use('/conversations', c.conversationsRouter);
  api.use('/conversations', c.readStatesRouter);
  api.use('/files', c.files.uploadRouter);
  api.use('/files', c.files.downloadRouter);
  api.use(c.messagesRouter);
  api.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
  });
  app.use('/api', api);

  if (config.serveWebDir) {
    const dir = resolve(config.serveWebDir);
    if (existsSync(join(dir, 'index.html'))) {
      app.use(
        express.static(dir, {
          index: false,
          maxAge: '1y',
          immutable: true,
          setHeaders: (res, path) => {
            if (path.endsWith('index.html') || path.endsWith('sw.js'))
              res.setHeader('Cache-Control', 'no-cache');
          },
        }),
      );
      app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(join(dir, 'index.html'));
      });
    }
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.toJSON() });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Validation failed' } });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Malformed JSON' } });
      return;
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'payload_too_large', message: 'Payload too large' } });
      return;
    }
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
  };
  app.use(onError);

  return app;
}
