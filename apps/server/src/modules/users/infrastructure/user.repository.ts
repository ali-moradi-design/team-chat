import type { WorkspaceRole } from '@team-chat/shared';
import type { UserRepository } from '../application/ports';
import { hueFromHandle, type NewUser, type UserAuthRecord, type UserRecord } from '../domain/user';
import { UserModel, type UserDoc } from './user.model';

const PUBLIC_FIELDS = 'name handle email role hue isBot disabled createdAt';

function toRecord(d: UserDoc): UserRecord {
  return {
    id: d._id.toString(),
    name: d.name,
    handle: d.handle,
    email: d.email,
    role: d.role,
    hue: d.hue,
    isBot: d.isBot,
    disabled: d.disabled,
    createdAt: d.createdAt,
  };
}

export class MongoUserRepository implements UserRepository {
  async create(input: NewUser): Promise<UserRecord> {
    const doc = await UserModel.create({ ...input, hue: hueFromHandle(input.handle) });
    return toRecord(doc.toObject());
  }

  async findById(id: string) {
    const d = await UserModel.findById(id).select(PUBLIC_FIELDS).lean<UserDoc>();
    return d ? toRecord(d) : null;
  }

  async findAuthByEmail(email: string): Promise<UserAuthRecord | null> {
    const d = await UserModel.findOne({ email: email.toLowerCase() }).lean<UserDoc>();
    return d ? { ...toRecord(d), passwordHash: d.passwordHash } : null;
  }

  async findByHandle(handle: string) {
    const d = await UserModel.findOne({ handle }).select(PUBLIC_FIELDS).lean<UserDoc>();
    return d ? toRecord(d) : null;
  }

  async findByHandles(handles: string[]) {
    if (handles.length === 0) return [];
    const docs = await UserModel.find({ handle: { $in: handles } })
      .select(PUBLIC_FIELDS)
      .lean<UserDoc[]>();
    return docs.map(toRecord);
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const docs = await UserModel.find({ _id: { $in: ids } })
      .select(PUBLIC_FIELDS)
      .lean<UserDoc[]>();
    return docs.map(toRecord);
  }

  async list() {
    const docs = await UserModel.find({ disabled: false })
      .select(PUBLIC_FIELDS)
      .sort({ name: 1 })
      .lean<UserDoc[]>();
    return docs.map(toRecord);
  }

  count() {
    return UserModel.estimatedDocumentCount();
  }

  async setRole(id: string, role: WorkspaceRole) {
    const d = await UserModel.findByIdAndUpdate(id, { role }, { returnDocument: 'after' })
      .select(PUBLIC_FIELDS)
      .lean<UserDoc>();
    return d ? toRecord(d) : null;
  }

  async setName(id: string, name: string) {
    const d = await UserModel.findByIdAndUpdate(id, { name }, { returnDocument: 'after' })
      .select(PUBLIC_FIELDS)
      .lean<UserDoc>();
    return d ? toRecord(d) : null;
  }
}
