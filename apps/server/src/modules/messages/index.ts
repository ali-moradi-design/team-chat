import type { RequestHandler, Router } from 'express';
import type { EventBus } from '../../lib/eventBus';
import type { ConversationsService } from '../conversations';
import type { UsersService } from '../users';
import { MessagesService } from './application/messages.service';
import type { AttachmentPort, ReadPointerPort } from './application/ports';
import { MongoMessageRepository } from './infrastructure/message.repository';
import { messagesRoutes } from './presentation/messages.routes';

export { MessagesService } from './application/messages.service';
export type { AttachmentPort, ReadPointerPort } from './application/ports';
export { MessageModel } from './infrastructure/message.model';
export { attachmentUrl } from './domain/message';
export type { StoredAttachment } from './domain/message';

export function createMessagesModule(deps: {
  bus: EventBus;
  conversations: ConversationsService;
  users: UsersService;
  attachments: AttachmentPort;
  readPointers: () => ReadPointerPort;
}): { service: MessagesService; createRouter: (requireAuth: RequestHandler) => Router } {
  const service = new MessagesService(
    new MongoMessageRepository(),
    deps.conversations,
    deps.users,
    deps.attachments,
    deps.readPointers,
    deps.bus,
  );
  return { service, createRouter: (requireAuth) => messagesRoutes(service, requireAuth) };
}
