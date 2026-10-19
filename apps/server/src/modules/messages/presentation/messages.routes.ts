import { Router, type RequestHandler } from 'express';
import { historyQuery, objectId, searchQuery } from '@team-chat/shared';
import { currentUser, param, parse } from '../../../lib/http';
import type { MessagesService } from '../application/messages.service';

/** Read-only REST endpoints. Writes go through Socket.IO (ack + realtime fan-out). */
export function messagesRoutes(service: MessagesService, requireAuth: RequestHandler): Router {
  const r = Router();
  r.use(requireAuth);

  r.get('/conversations/:id/messages', async (req, res) => {
    const id = parse(objectId, param(req, 'id'));
    const q = parse(historyQuery, req.query);
    res.set('Cache-Control', 'no-store');
    res.json(await service.history(currentUser(req).id, id, q));
  });

  r.get('/conversations/:id/pins', async (req, res) => {
    const id = parse(objectId, param(req, 'id'));
    res.json({ messages: await service.pins(currentUser(req).id, id) });
  });

  r.get('/messages/:id/thread', async (req, res) => {
    const id = parse(objectId, param(req, 'id'));
    res.set('Cache-Control', 'no-store');
    res.json(await service.thread(currentUser(req).id, id));
  });

  r.get('/search', async (req, res) => {
    const q = parse(searchQuery, req.query);
    res.json(await service.search(currentUser(req).id, q));
  });

  return r;
}
