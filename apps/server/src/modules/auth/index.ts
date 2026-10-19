import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { Config } from '../../config/env';
import { unauthorized } from '../../lib/errors';
import type { UsersService, UserRecord } from '../users';
import { AuthService } from './application/auth.service';
import { Argon2Hasher } from './infrastructure/argon2Hasher';
import { JwtTokenIssuer } from './infrastructure/jwtTokens';
import { MongoRefreshTokenRepository } from './infrastructure/refreshToken.repository';
import { authRoutes, MEDIA_COOKIE } from './presentation/auth.routes';

export { AuthService, toMe } from './application/auth.service';

export interface AuthModule {
  service: AuthService;
  router: Router;
  requireAuth: RequestHandler;
  requireMediaAuth: RequestHandler;
}

export function createAuthModule(deps: {
  config: Config;
  users: UsersService;
  onRegistered?: (user: UserRecord) => Promise<void>;
}): AuthModule {
  const tokens = new JwtTokenIssuer(deps.config.jwtSecret, deps.config.accessTtlSec);
  const service = new AuthService(
    deps.users,
    new Argon2Hasher(deps.config.isTest),
    tokens,
    new MongoRefreshTokenRepository(),
    deps.config.refreshTtlDays * 24 * 3600 * 1000,
    deps.onRegistered,
  );
  const requireAuth = makeRequireAuth((t) => service.authenticate(t));
  const requireMediaAuth: RequestHandler = async (req, _res, next) => {
    try {
      const token = req.cookies?.[MEDIA_COOKIE];
      if (typeof token !== 'string') throw unauthorized('Missing media session');
      req.user = await service.authenticateMedia(token);
      next();
    } catch (e) {
      next(e);
    }
  };
  return {
    service,
    router: authRoutes(service, deps.config, requireAuth),
    requireAuth,
    requireMediaAuth,
  };
}

export function makeRequireAuth(
  authenticate: (token: string) => Promise<UserRecord>,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.get('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) throw unauthorized('Missing bearer token');
      req.user = await authenticate(token);
      next();
    } catch (e) {
      next(e);
    }
  };
}
