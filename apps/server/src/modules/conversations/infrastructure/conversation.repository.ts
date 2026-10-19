import { Types } from 'mongoose';
import type { MemberRole } from '@team-chat/shared';
import type { ConversationRepository, NewConversation } from '../application/ports';
import {
  channelNameKey,
  dmKey,
  type ConversationMember,
  type ConversationRecord,
  type LastMessage,
} from '../domain/conversation';
import { ConversationModel, type ConversationDoc } from './conversation.model';

function toRecord(d: ConversationDoc): ConversationRecord {
  return {
    id: d._id.toString(),
    type: d.type,
    ...(d.name ? { name: d.name } : {}),
    ...(d.topic ? { topic: d.topic } : {}),
    ...(d.description ? { description: d.description } : {}),
    isPrivate: d.isPrivate,
    members: d.members.map((m) => ({ userId: m.userId.toString(), role: m.role })),
    createdAt: d.createdAt,
    ...(d.lastMessageAt ? { lastMessageAt: d.lastMessageAt } : {}),
    ...(d.lastMessage
      ? {
          lastMessage: {
            id: d.lastMessage.id.toString(),
            authorId: d.lastMessage.authorId.toString(),
            text: d.lastMessage.text,
            createdAt: d.lastMessage.createdAt,
          },
        }
      : {}),
  };
}

const oid = (id: string) => new Types.ObjectId(id);
const memberDocs = (members: ConversationMember[]) =>
  members.map((m) => ({ userId: oid(m.userId), role: m.role, joinedAt: new Date() }));

export class MongoConversationRepository implements ConversationRepository {
  async create(input: NewConversation): Promise<ConversationRecord> {
    const doc = await ConversationModel.create({
      type: input.type,
      ...(input.name ? { name: input.name, nameKey: channelNameKey(input.name) } : {}),
      ...(input.type === 'dm' ? { dmKey: dmKey(input.members.map((m) => m.userId)) } : {}),
      topic: input.topic,
      description: input.description,
      isPrivate: input.isPrivate,
      members: memberDocs(input.members),
      createdBy: oid(input.createdBy),
    });
    return toRecord(doc.toObject());
  }

  async findById(id: string) {
    const d = await ConversationModel.findById(id).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async findChannelByName(name: string) {
    const d = await ConversationModel.findOne({
      type: 'channel',
      nameKey: channelNameKey(name),
    }).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async findDmByMembers(userIds: string[]) {
    const d = await ConversationModel.findOne({
      type: 'dm',
      dmKey: dmKey(userIds),
    }).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async listForUser(userId: string) {
    const docs = await ConversationModel.find({ 'members.userId': oid(userId) })
      .sort({ lastMessageAt: -1, _id: -1 })
      .lean<ConversationDoc[]>();
    return docs.map(toRecord);
  }

  async listPublicNotJoined(userId: string) {
    const docs = await ConversationModel.find({
      type: 'channel',
      isPrivate: false,
      'members.userId': { $ne: oid(userId) },
    })
      .sort({ nameKey: 1 })
      .limit(200)
      .lean<ConversationDoc[]>();
    return docs.map(toRecord);
  }

  async idsForUser(userId: string) {
    const docs = await ConversationModel.find({ 'members.userId': oid(userId) })
      .select('_id')
      .lean<Array<{ _id: Types.ObjectId }>>();
    return docs.map((d) => d._id.toString());
  }

  async update(id: string, patch: { name?: string; topic?: string; description?: string }) {
    const set: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      set.name = patch.name;
      set.nameKey = channelNameKey(patch.name);
    }
    if (patch.topic !== undefined) set.topic = patch.topic;
    if (patch.description !== undefined) set.description = patch.description;
    const d = await ConversationModel.findByIdAndUpdate(
      id,
      { $set: set },
      { returnDocument: 'after' },
    ).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async addMembers(id: string, members: ConversationMember[]) {
    const d = await ConversationModel.findOneAndUpdate(
      { _id: id },
      { $push: { members: { $each: memberDocs(members) } } },
      { returnDocument: 'after' },
    ).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async removeMember(id: string, userId: string) {
    const d = await ConversationModel.findByIdAndUpdate(
      id,
      { $pull: { members: { userId: oid(userId) } } },
      { returnDocument: 'after' },
    ).lean<ConversationDoc>();
    return d ? toRecord(d) : null;
  }

  async setMemberRole(id: string, userId: string, role: MemberRole) {
    await ConversationModel.updateOne(
      { _id: id, 'members.userId': oid(userId) },
      { $set: { 'members.$.role': role } },
    );
  }

  async setLastMessage(id: string, last: LastMessage) {
    // Only move forward: concurrent senders must not rewind the preview.
    await ConversationModel.updateOne(
      {
        _id: id,
        $or: [{ lastMessageAt: { $exists: false } }, { lastMessageAt: { $lte: last.createdAt } }],
      },
      {
        $set: {
          lastMessageAt: last.createdAt,
          lastMessage: {
            id: oid(last.id),
            authorId: oid(last.authorId),
            text: last.text,
            createdAt: last.createdAt,
          },
        },
      },
    );
  }
}
