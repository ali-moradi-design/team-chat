import { Router, type RequestHandler } from 'express';
import {
  addMembersBody,
  createChannelBody,
  createDmBody,
  muteBody,
  objectId,
  updateConversationBody,
} from '@team-chat/shared';
import { currentUser, param, parse } from '../../../lib/http';
import type { ConversationsService } from '../application/conversations.service';

export function conversationsRoutes(
  service: ConversationsService,
  requireAuth: RequestHandler,
): Router {
  const r = Router();
  r.use(requireAuth);
  const id = (req: Parameters<typeof param>[0]) => parse(objectId, param(req, 'id'));

  r.get('/', async (req, res) => {
    res.json({ conversations: await service.list(currentUser(req).id) });
  });

  r.get('/browse', async (req, res) => {
    res.json({ channels: await service.browse(currentUser(req).id) });
  });

  r.post('/', async (req, res) => {
    const body = parse(createChannelBody, req.body);
    res.status(201).json({ conversation: await service.createChannel(currentUser(req), body) });
  });

  r.post('/dm', async (req, res) => {
    const body = parse(createDmBody, req.body);
    res.json({ conversation: await service.openDm(currentUser(req), body.userIds) });
  });

  r.get('/:id', async (req, res) => {
    res.json({ conversation: await service.summaryFor(currentUser(req).id, id(req)) });
  });

  r.patch('/:id', async (req, res) => {
    const body = parse(updateConversationBody, req.body);
    res.json({ conversation: await service.update(currentUser(req), id(req), body) });
  });

  r.post('/:id/join', async (req, res) => {
    res.json({ conversation: await service.join(currentUser(req), id(req)) });
  });

  r.post('/:id/leave', async (req, res) => {
    const user = currentUser(req);
    await service.removeMember(user, id(req), user.id);
    res.status(204).end();
  });

  r.post('/:id/members', async (req, res) => {
    const body = parse(addMembersBody, req.body);
    res.json({ conversation: await service.addMembers(currentUser(req), id(req), body.userIds) });
  });

  r.delete('/:id/members/:userId', async (req, res) => {
    await service.removeMember(currentUser(req), id(req), parse(objectId, param(req, 'userId')));
    res.status(204).end();
  });

  r.put('/:id/mute', async (req, res) => {
    const body = parse(muteBody, req.body);
    await service.setMuted(currentUser(req).id, id(req), body.muted);
    res.status(204).end();
  });

  return r;
}
