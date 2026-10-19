import type { Router } from 'express';
import type { Config } from './config/env';
import { EventBus } from './lib/eventBus';
import { createAuthModule, type AuthModule } from './modules/auth';
import { createConversationsModule, type ConversationsService } from './modules/conversations';
import { createFilesModule, type FilesService } from './modules/files';
import { createMessagesModule, type MessagesService } from './modules/messages';
import { createReadStatesModule, type ReadStatesService } from './modules/read-states';
import { createUsersModule, type UsersService } from './modules/users';

export interface Container {
  bus: EventBus;
  users: UsersService;
  auth: AuthModule;
  conversations: ConversationsService;
  messages: MessagesService;
  readStates: ReadStatesService;
  files: { service: FilesService; uploadRouter: Router; downloadRouter: Router };
  usersRouter: Router;
  conversationsRouter: Router;
  messagesRouter: Router;
  readStatesRouter: Router;
}

/** Composition root: the only place where modules are wired to each other. */
export function buildContainer(config: Config): Container {
  const bus = new EventBus();
  const usersModule = createUsersModule({ bus });

  // Modules reference each other lazily (through these cells) to break construction cycles.
  const late: {
    conversations?: ConversationsService;
    messages?: MessagesService;
    readStates?: ReadStatesService;
  } = {};
  const need = <T>(v: T | undefined, name: string): T => {
    if (!v) throw new Error(`${name} not initialised`);
    return v;
  };

  const auth = createAuthModule({
    config,
    users: usersModule.service,
    onRegistered: (user) => need(late.conversations, 'conversations').joinDefaultChannel(user),
  });

  const readStatesModule = createReadStatesModule({
    bus,
    counter: () => need(late.messages, 'messages'),
    membership: () => ({
      requireMember: async (conversationId, userId) => {
        const conv = await need(late.conversations, 'conversations').requireMember(
          conversationId,
          userId,
        );
        return { id: conv.id, type: conv.type, memberIds: conv.members.map((m) => m.userId) };
      },
    }),
    messages: () => need(late.messages, 'messages'),
  });
  late.readStates = readStatesModule.service;

  const conversationsModule = createConversationsModule({
    bus,
    users: usersModule.service,
    readStates: readStatesModule.service,
  });
  late.conversations = conversationsModule.service;

  const filesModule = createFilesModule({
    config,
    requireAuth: auth.requireAuth,
    requireMediaAuth: auth.requireMediaAuth,
    membership: () => ({
      isMember: (conversationId, userId) =>
        need(late.conversations, 'conversations')
          .requireMember(conversationId, userId)
          .then(
            () => true,
            () => false,
          ),
    }),
  });

  const messagesModule = createMessagesModule({
    bus,
    conversations: conversationsModule.service,
    users: usersModule.service,
    attachments: filesModule.service,
    readPointers: () => need(late.readStates, 'readStates'),
  });
  late.messages = messagesModule.service;

  return {
    bus,
    users: usersModule.service,
    auth,
    conversations: conversationsModule.service,
    messages: messagesModule.service,
    readStates: readStatesModule.service,
    files: filesModule,
    usersRouter: usersModule.createRouter(auth.requireAuth),
    conversationsRouter: conversationsModule.createRouter(auth.requireAuth),
    messagesRouter: messagesModule.createRouter(auth.requireAuth),
    readStatesRouter: readStatesModule.createRouter(auth.requireAuth),
  };
}
