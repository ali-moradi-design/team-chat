import type { RequestHandler, Router } from 'express';
import type { EventBus } from '../../lib/eventBus';
import { UsersService } from './application/users.service';
import { MongoUserRepository } from './infrastructure/user.repository';
import { usersRoutes } from './presentation/users.routes';

export { UsersService } from './application/users.service';
export { toPublicUser, isAdmin, hueFromHandle } from './domain/user';
export type { UserRecord } from './domain/user';
export { UserModel } from './infrastructure/user.model';

export function createUsersModule(deps: { bus: EventBus }): {
  service: UsersService;
  createRouter: (requireAuth: RequestHandler) => Router;
} {
  const service = new UsersService(new MongoUserRepository(), deps.bus);
  return { service, createRouter: (requireAuth) => usersRoutes(service, requireAuth) };
}
