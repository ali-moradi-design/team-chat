import type {
  Conversation,
  ConversationSummary,
  CreateChannelBody,
  MemberRole,
} from '@team-chat/shared';
import { LIMITS } from '@team-chat/shared';
import { badRequest, conflict, forbidden, notFound } from '../../../lib/errors';
import type { EventBus } from '../../../lib/eventBus';
import { sanitizeText } from '../../../lib/sanitize';
import { isAdmin, type UserRecord, type UsersService } from '../../users';
import {
  DEFAULT_CHANNEL,
  assertMember,
  canManage,
  isMember,
  normalizeChannelName,
  toConversation,
  type ConversationMember,
  type ConversationRecord,
  type LastMessage,
} from '../domain/conversation';
import type { ConversationRepository, ReadStatePort } from './ports';

export class ConversationsService {
  constructor(
    private readonly repo: ConversationRepository,
    private readonly readStates: ReadStatePort,
    private readonly users: UsersService,
    private readonly bus: EventBus,
  ) {}

  // ---- queries ---------------------------------------------------------------------------

  async list(userId: string): Promise<ConversationSummary[]> {
    const convs = await this.repo.listForUser(userId);
    return this.summarize(userId, convs);
  }

  async summaryFor(userId: string, conversationId: string): Promise<ConversationSummary> {
    const conv = await this.requireConversation(conversationId);
    assertMember(conv, userId);
    const [summary] = await this.summarize(userId, [conv]);
    if (!summary) throw notFound();
    return summary;
  }

  async browse(userId: string): Promise<Conversation[]> {
    return (await this.repo.listPublicNotJoined(userId)).map(toConversation);
  }

  idsForUser = (userId: string) => this.repo.idsForUser(userId);

  async get(conversationId: string, userId: string): Promise<ConversationRecord> {
    const conv = await this.requireConversation(conversationId);
    // Public channels are readable by name in "browse"; everything else needs membership.
    if (!isMember(conv, userId)) throw forbidden('You are not a member of this conversation');
    return conv;
  }

  /** Throws unless the user is a member. Used by other modules (messages, files). */
  async requireMember(conversationId: string, userId: string): Promise<ConversationRecord> {
    return this.get(conversationId, userId);
  }

  async memberIds(conversationId: string): Promise<string[]> {
    const conv = await this.requireConversation(conversationId);
    return conv.members.map((m) => m.userId);
  }

  // ---- commands --------------------------------------------------------------------------

  async createChannel(user: UserRecord, body: CreateChannelBody): Promise<ConversationSummary> {
    const name = normalizeChannelName(sanitizeText(body.name, LIMITS.nameMaxLength));
    if (name.length < 2) throw badRequest('Channel name is too short');
    if (await this.repo.findChannelByName(name))
      throw conflict('A channel with this name already exists');

    const others = await this.validUserIds(body.memberIds.filter((id) => id !== user.id));
    const members: ConversationMember[] = [
      { userId: user.id, role: 'owner' },
      ...others.map((userId) => ({ userId, role: 'member' as const })),
    ];
    const conv = await this.repo.create({
      type: 'channel',
      name,
      ...(body.topic ? { topic: sanitizeText(body.topic, LIMITS.topicMaxLength) } : {}),
      ...(body.description
        ? { description: sanitizeText(body.description, LIMITS.descriptionMaxLength) }
        : {}),
      isPrivate: body.isPrivate,
      members,
      createdBy: user.id,
    });
    await Promise.all(members.map((m) => this.readStates.init(m.userId, conv.id)));
    const summaries = await this.summariesForMembers(conv);
    this.bus.publish('conversation.created', { summaries });
    return summaries.find((s) => s.userId === user.id)!.summary;
  }

  async openDm(user: UserRecord, otherIds: string[]): Promise<ConversationSummary> {
    const ids = [...new Set([user.id, ...otherIds])];
    if (ids.length > LIMITS.maxDmMembers) throw badRequest('Too many people for a direct message');
    const valid = await this.validUserIds(ids);
    if (valid.length !== ids.length) throw badRequest('Unknown user');

    const existing = await this.repo.findDmByMembers(ids);
    if (existing) return this.summaryFor(user.id, existing.id);

    try {
      const conv = await this.repo.create({
        type: 'dm',
        isPrivate: true,
        members: ids.map((userId) => ({ userId, role: 'member' as const })),
        createdBy: user.id,
      });
      await Promise.all(ids.map((id) => this.readStates.init(id, conv.id)));
      const summaries = await this.summariesForMembers(conv);
      this.bus.publish('conversation.created', { summaries });
      return summaries.find((s) => s.userId === user.id)!.summary;
    } catch (e) {
      // Lost a race with a concurrent identical request: return the winner.
      const winner = await this.repo.findDmByMembers(ids);
      if (winner) return this.summaryFor(user.id, winner.id);
      throw e;
    }
  }

  async update(
    user: UserRecord,
    conversationId: string,
    patch: { name?: string; topic?: string; description?: string },
  ): Promise<Conversation> {
    const conv = await this.get(conversationId, user.id);
    if (conv.type !== 'channel') throw badRequest('Direct messages cannot be edited');
    const clean: { name?: string; topic?: string; description?: string } = {};
    if (patch.topic !== undefined) clean.topic = sanitizeText(patch.topic, LIMITS.topicMaxLength);
    if (patch.name !== undefined || patch.description !== undefined) {
      if (!canManage(conv, user))
        throw forbidden('Only the channel owner or an admin can change this');
      if (patch.description !== undefined)
        clean.description = sanitizeText(patch.description, LIMITS.descriptionMaxLength);
      if (patch.name !== undefined) {
        const name = normalizeChannelName(sanitizeText(patch.name, LIMITS.nameMaxLength));
        if (name.length < 2) throw badRequest('Channel name is too short');
        const clash = await this.repo.findChannelByName(name);
        if (clash && clash.id !== conv.id)
          throw conflict('A channel with this name already exists');
        clean.name = name;
      }
    }
    const updated = await this.repo.update(conversationId, clean);
    if (!updated) throw notFound();
    const dto = toConversation(updated);
    this.bus.publish('conversation.updated', { conversation: dto });
    return dto;
  }

  async join(user: UserRecord, conversationId: string): Promise<ConversationSummary> {
    const conv = await this.requireConversation(conversationId);
    if (isMember(conv, user.id)) return this.summaryFor(user.id, conv.id);
    if (conv.type !== 'channel' || conv.isPrivate) throw forbidden('This channel is private');
    return this.addMemberRecords(conv, [user.id]).then((s) => s.get(user.id)!);
  }

  async addMembers(
    actor: UserRecord,
    conversationId: string,
    userIds: string[],
  ): Promise<Conversation> {
    const conv = await this.get(conversationId, actor.id);
    if (conv.type !== 'channel') throw badRequest('Cannot add people to a direct message');
    if (conv.isPrivate && !canManage(conv, actor))
      throw forbidden('Only the owner or an admin can invite people');
    const fresh = (await this.validUserIds(userIds)).filter((id) => !isMember(conv, id));
    if (fresh.length > 0) await this.addMemberRecords(conv, fresh);
    return toConversation((await this.repo.findById(conversationId)) ?? conv);
  }

  async removeMember(actor: UserRecord, conversationId: string, targetId: string): Promise<void> {
    const conv = await this.get(conversationId, actor.id);
    if (conv.type !== 'channel') throw badRequest('Cannot remove people from a direct message');
    const self = actor.id === targetId;
    if (!self && !canManage(conv, actor))
      throw forbidden('Only the owner or an admin can remove people');
    if (!isMember(conv, targetId)) throw notFound('Not a member');

    const updated = await this.repo.removeMember(conversationId, targetId);
    await this.readStates.remove(targetId, conversationId);
    // Keep at least one owner when people remain.
    if (updated && updated.members.length > 0 && !updated.members.some((m) => m.role === 'owner')) {
      const heir = updated.members[0]!;
      await this.repo.setMemberRole(conversationId, heir.userId, 'owner');
    }
    const after = (await this.repo.findById(conversationId)) ?? updated;
    this.bus.publish('conversation.member-removed', { conversationId, userId: targetId });
    if (after) this.bus.publish('conversation.updated', { conversation: toConversation(after) });
  }

  async setMuted(userId: string, conversationId: string, muted: boolean): Promise<void> {
    await this.get(conversationId, userId);
    await this.readStates.setMuted(userId, conversationId, muted);
  }

  /** Called by the messages module after a top-level message is stored. */
  touch(conversationId: string, last: LastMessage): Promise<void> {
    return this.repo.setLastMessage(conversationId, last);
  }

  /** Every new account joins #general (created on first use). */
  async joinDefaultChannel(user: UserRecord): Promise<void> {
    let general = await this.repo.findChannelByName(DEFAULT_CHANNEL);
    if (!general) {
      try {
        general = await this.repo.create({
          type: 'channel',
          name: DEFAULT_CHANNEL,
          topic: 'Company-wide announcements and chatter',
          isPrivate: false,
          members: [{ userId: user.id, role: 'owner' }],
          createdBy: user.id,
        });
        await this.readStates.init(user.id, general.id);
        return;
      } catch {
        general = await this.repo.findChannelByName(DEFAULT_CHANNEL);
      }
    }
    if (general && !isMember(general, user.id)) {
      await this.repo.addMembers(general.id, [{ userId: user.id, role: 'member' }]);
      const last = general.lastMessage?.id;
      await this.readStates.init(user.id, general.id, last);
      const updated = await this.repo.findById(general.id);
      if (updated)
        this.bus.publish('conversation.updated', { conversation: toConversation(updated) });
    }
  }

  // ---- helpers ---------------------------------------------------------------------------

  private async addMemberRecords(
    conv: ConversationRecord,
    userIds: string[],
  ): Promise<Map<string, ConversationSummary>> {
    const updated = await this.repo.addMembers(
      conv.id,
      userIds.map((userId) => ({ userId, role: 'member' as MemberRole })),
    );
    if (!updated) throw notFound();
    const lastId = updated.lastMessage?.id;
    await Promise.all(userIds.map((id) => this.readStates.init(id, conv.id, lastId)));
    const out = new Map<string, ConversationSummary>();
    const summaries: Array<{ userId: string; summary: ConversationSummary }> = [];
    for (const id of userIds) {
      const [summary] = await this.summarize(id, [updated]);
      if (summary) {
        out.set(id, summary);
        summaries.push({ userId: id, summary });
      }
    }
    this.bus.publish('conversation.members-added', { conversationId: conv.id, summaries });
    this.bus.publish('conversation.updated', { conversation: toConversation(updated) });
    return out;
  }

  private async summariesForMembers(conv: ConversationRecord) {
    const out: Array<{ userId: string; summary: ConversationSummary }> = [];
    for (const m of conv.members) {
      const [summary] = await this.summarize(m.userId, [conv]);
      if (summary) out.push({ userId: m.userId, summary });
    }
    return out;
  }

  private async requireConversation(id: string): Promise<ConversationRecord> {
    const conv = await this.repo.findById(id);
    if (!conv) throw notFound('Conversation not found');
    return conv;
  }

  private async validUserIds(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const found = await this.users.findByIds(unique);
    return found.filter((u) => !u.disabled).map((u) => u.id);
  }

  private async summarize(
    userId: string,
    convs: ConversationRecord[],
  ): Promise<ConversationSummary[]> {
    if (convs.length === 0) return [];
    const ids = convs.map((c) => c.id);
    const states = await this.readStates.getStates(userId, ids);
    const counts = await this.readStates.unreadCounts(
      userId,
      convs.map((c) => {
        const lastRead = states.get(c.id)?.lastReadMessageId;
        return { conversationId: c.id, ...(lastRead ? { lastReadMessageId: lastRead } : {}) };
      }),
    );
    const dmPeers = await Promise.all(
      convs.map((c) =>
        c.type === 'dm'
          ? this.readStates.peerReads(
              c.id,
              c.members.map((m) => m.userId).filter((id) => id !== userId),
            )
          : Promise.resolve(undefined),
      ),
    );
    return convs.map((c, i) => {
      const state = states.get(c.id);
      const count = counts.get(c.id);
      const peers = dmPeers[i];
      return {
        ...toConversation(c),
        unreadCount: count?.unread ?? 0,
        mentionCount: count?.mentions ?? 0,
        muted: state?.muted ?? false,
        ...(state?.lastReadMessageId ? { lastReadMessageId: state.lastReadMessageId } : {}),
        ...(peers && Object.keys(peers).length ? { peerReads: peers } : {}),
      };
    });
  }
}

export { isAdmin };
