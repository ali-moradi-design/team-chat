import { Router, type RequestHandler } from 'express';
import { objectId, updateProfileBody, updateRoleBody, meSchema } from '@team-chat/shared';
import { currentUser, param, parse } from '../../../lib/http';
import { toPublicUser } from '../domain/user';
import type { UsersService } from '../application/users.service';

export function usersRoutes(service: UsersService, requireAuth: RequestHandler): Router {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res) => {
    const users = await service.list();
    res.set('Cache-Control', 'private, max-age=30');
    res.json({ users: users.map(toPublicUser) });
  });

  r.patch('/me', async (req, res) => {
    const body = parse(updateProfileBody, req.body);
    const user = await service.rename(currentUser(req).id, body.name);
    res.json({ user: meSchema.parse({ ...toPublicUser(user), email: user.email }) });
  });

  r.patch('/:id/role', async (req, res) => {
    const id = parse(objectId, param(req, 'id'));
    const body = parse(updateRoleBody, req.body);
    const user = await service.changeRole(currentUser(req), id, body.role);
    res.json({ user: toPublicUser(user) });
  });

  return r;
}
