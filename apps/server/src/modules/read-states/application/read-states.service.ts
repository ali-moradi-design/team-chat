import { badRequest } from '../../../lib/errors';
import type { EventBus } from '../../../lib/eventBus';
import type { ReadStatePort } from '../../conversations';
import type { ReadPointerPort } from '../../messages';
import type {
  MembershipPort,
  MessageLookupPort,
  ReadStateRepository,
  UnreadCounterPort,
} from './ports';

export class ReadStatesService implements ReadStatePort, ReadPointerPort {
  constructor(
    private readonly repo: ReadStateRepository,
    private readonly counter: () => UnreadCounterPort,
    private readonly membership: () => MembershipPort,
    private readonly messages: () => MessageLookupPort,
    private readonly bus: EventBus,
  ) {}

  getStates: ReadStatePort['getStates'] = (userId, ids) => this.repo.getMany(userId, ids);
  unreadCounts: ReadStatePort['unreadCounts'] = (userId, items) =>
    this.counter().countUnread(userId, items);
  init: ReadStatePort['init'] = (userId, conversationId, last) =>
    this.repo.upsertInitial(userId, conversationId, last);
  setMuted: ReadStatePort['setMuted'] = (userId, conversationId, muted) =>
    this.repo.setMuted(userId, conversationId, muted);
  remove: ReadStatePort['remove'] = (userId, conversationId) =>
    this.repo.remove(userId, conversationId);

  async peerReads(conversationId: string, userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    return this.repo.pointersFor(conversationId, userIds);
  }

  markReadSilently(userId: string, conversationId: string, messageId: string): Promise<void> {
    return this.repo.advance(userId, conversationId, messageId);
  }

  /** Public command: validates membership and that the message belongs to the conversation. */
  async markRead(userId: string, conversationId: string, messageId: string): Promise<void> {
    const conv = await this.membership().requireMember(conversationId, userId);
    const owner = await this.messages().conversationIdOf(messageId);
    if (owner !== conversationId) throw badRequest('Message is not part of this conversation');
    await this.repo.advance(userId, conversationId, messageId);
    // DM peers get "seen by"; the reader's other tabs clear their badge.
    const notify = conv.type === 'dm' ? conv.memberIds : [userId];
    this.bus.publish('read.updated', { conversationId, userId, messageId, notify });
  }
}
