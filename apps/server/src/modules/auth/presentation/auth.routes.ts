import {
  Router,
  type CookieOptions,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { loginBody, registerBody, type Me } from '@team-chat/shared';
import { currentUser, parse } from '../../../lib/http';
import type { Config } from '../../../config/env';
import type { AuthService, Session } from '../application/auth.service';
import { toMe } from '../application/auth.service';

export const REFRESH_COOKIE = 'tc_refresh';
export const MEDIA_COOKIE = 'tc_media';

type CookieConfig = Pick<Config, 'cookieSecure' | 'isTest' | 'demoMode'>;

export function authRoutes(
  service: AuthService,
  config: CookieConfig,
  requireAuth: RequestHandler,
): Router {
  const r = Router();

  // Brute-force protection on credential endpoints (per IP).
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isTest ? 1000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } },
  });

  const cookieBase = (path: string): CookieOptions => ({
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path,
  });

  const setSessionCookies = (res: Response, s: Session) => {
    res.cookie(MEDIA_COOKIE, s.mediaToken, {
      ...cookieBase('/api/files'),
      maxAge: 12 * 3600 * 1000,
      sameSite: 'lax',
    });
    if (s.refreshToken && s.refreshExpiresAt) {
      res.cookie(REFRESH_COOKIE, s.refreshToken, {
        ...cookieBase('/api/auth'),
        expires: s.refreshExpiresAt,
      });
    }
  };

  const respond = (res: Response, s: Session, status = 200) => {
    setSessionCookies(res, s);
    res.status(status).json({ accessToken: s.accessToken, user: s.user });
  };

  const ua = (req: Request) => req.get('user-agent') ?? undefined;

  r.post('/register', limiter, async (req, res) => {
    respond(res, await service.register(parse(registerBody, req.body), ua(req)), 201);
  });

  r.post('/login', limiter, async (req, res) => {
    respond(res, await service.login(parse(loginBody, req.body), ua(req)));
  });

  if (config.demoMode) {
    r.post('/demo', limiter, async (req, res) => {
      const { handle } = parse(z.object({ handle: z.enum(['ali', 'sara']) }), req.body);
      respond(res, await service.loginAsDemo(`${handle}@demo.dev`, ua(req)));
    });
  }

  r.post('/refresh', async (req, res) => {
    // Cookie is SameSite=Strict; the header additionally blocks simple cross-site form posts.
    if (req.get('x-requested-with') !== 'team-chat') {
      res
        .status(400)
        .json({ error: { code: 'bad_request', message: 'Missing X-Requested-With header' } });
      return;
    }
    respond(res, await service.refresh(req.cookies?.[REFRESH_COOKIE], ua(req)));
  });

  r.post('/logout', async (req, res) => {
    await service.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieBase('/api/auth'));
    res.clearCookie(MEDIA_COOKIE, { ...cookieBase('/api/files'), sameSite: 'lax' });
    res.status(204).end();
  });

  r.get('/me', requireAuth, (req, res) => {
    const me: Me = toMe(currentUser(req));
    res.json({ user: me });
  });

  return r;
}
