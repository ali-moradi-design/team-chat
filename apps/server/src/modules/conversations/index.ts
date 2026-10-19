import type { RequestHandler, Router } from 'express';
import type { EventBus } from '../../lib/eventBus';
import type { UsersService } from '../users';
import { ConversationsService } from './application/conversations.service';
import type { ReadStatePort } from './application/ports';
import { MongoConversationRepository } from './infrastructure/conversation.repository';
import { conversationsRoutes } from './presentation/conversations.routes';

export { ConversationsService } from './application/conversations.service';
export type { ReadStatePort } from './application/ports';
export type { ConversationRecord } from './domain/conversation';
export { toConversation, isMember, canManage } from './domain/conversation';
export { ConversationModel } from './infrastructure/conversation.model';

export function createConversationsModule(deps: {
  bus: EventBus;
  users: UsersService;
  readStates: ReadStatePort;
}): { service: ConversationsService; createRouter: (requireAuth: RequestHandler) => Router } {
  const service = new ConversationsService(
    new MongoConversationRepository(),
    deps.readStates,
    deps.users,
    deps.bus,
  );
  return { service, createRouter: (requireAuth) => conversationsRoutes(service, requireAuth) };
}
