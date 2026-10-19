import type { RequestHandler, Router } from 'express';
import type { EventBus } from '../../lib/eventBus';
import { ReadStatesService } from './application/read-states.service';
import type { MembershipPort, MessageLookupPort, UnreadCounterPort } from './application/ports';
import { MongoReadStateRepository } from './infrastructure/readState.repository';
import { readStatesRoutes } from './presentation/read-states.routes';

export { ReadStatesService } from './application/read-states.service';
export { ReadStateModel } from './infrastructure/readState.model';

export function createReadStatesModule(deps: {
  bus: EventBus;
  counter: () => UnreadCounterPort;
  membership: () => MembershipPort;
  messages: () => MessageLookupPort;
}): { service: ReadStatesService; createRouter: (requireAuth: RequestHandler) => Router } {
  const service = new ReadStatesService(
    new MongoReadStateRepository(),
    deps.counter,
    deps.membership,
    deps.messages,
    deps.bus,
  );
  return { service, createRouter: (requireAuth) => readStatesRoutes(service, requireAuth) };
}
