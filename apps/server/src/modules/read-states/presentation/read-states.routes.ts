import { Router, type RequestHandler } from 'express';
import { markReadBody, objectId } from '@team-chat/shared';
import { currentUser, param, parse } from '../../../lib/http';
import type { ReadStatesService } from '../application/read-states.service';

export function readStatesRoutes(service: ReadStatesService, requireAuth: RequestHandler): Router {
  const r = Router();
  r.use(requireAuth);
  r.post('/:id/read', async (req, res) => {
    const id = parse(objectId, param(req, 'id'));
    const body = parse(markReadBody, req.body);
    await service.markRead(currentUser(req).id, id, body.messageId);
    res.status(204).end();
  });
  return r;
}
