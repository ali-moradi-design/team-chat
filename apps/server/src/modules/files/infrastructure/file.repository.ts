import { Types } from 'mongoose';
import type { FileRepository } from '../application/ports';
import type { FileRecord } from '../domain/file';
import { FileModel, type FileDoc } from './file.model';

const oid = (id: string) => new Types.ObjectId(id);

function toRecord(d: FileDoc): FileRecord {
  return {
    id: d._id.toString(),
    ownerId: d.ownerId.toString(),
    name: d.name,
    mime: d.mime,
    size: d.size,
    kind: d.kind,
    ...(d.width ? { width: d.width } : {}),
    ...(d.height ? { height: d.height } : {}),
    storageKey: d.storageKey,
    ...(d.thumbKey ? { thumbKey: d.thumbKey } : {}),
    ...(d.conversationId ? { conversationId: d.conversationId.toString() } : {}),
    ...(d.messageId ? { messageId: d.messageId.toString() } : {}),
    createdAt: d.createdAt,
  };
}

export class MongoFileRepository implements FileRepository {
  async create(input: Omit<FileRecord, 'id' | 'createdAt'>) {
    const doc = await FileModel.create({ ...input, ownerId: oid(input.ownerId) });
    return toRecord(doc.toObject());
  }

  async findById(id: string) {
    const d = await FileModel.findById(id).lean<FileDoc>();
    return d ? toRecord(d) : null;
  }

  async findOwnedUnattached(ownerId: string, ids: string[]) {
    const docs = await FileModel.find({
      _id: { $in: ids.map(oid) },
      ownerId: oid(ownerId),
      attached: false,
    }).lean<FileDoc[]>();
    return docs.map(toRecord);
  }

  async markAttached(ids: string[], conversationId: string, messageId: string) {
    await FileModel.updateMany(
      { _id: { $in: ids.map(oid) } },
      { $set: { conversationId: oid(conversationId), messageId: oid(messageId), attached: true } },
    );
  }

  async findOrphans(olderThan: Date, limit: number) {
    const docs = await FileModel.find({ attached: false, createdAt: { $lt: olderThan } })
      .limit(limit)
      .lean<FileDoc[]>();
    return docs.map(toRecord);
  }

  async deleteMany(ids: string[]) {
    if (ids.length) await FileModel.deleteMany({ _id: { $in: ids.map(oid) } });
  }
}
