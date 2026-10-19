import { Schema, model, type Types } from 'mongoose';

export interface FileDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'file';
  width?: number;
  height?: number;
  storageKey: string;
  thumbKey?: string;
  conversationId?: Types.ObjectId;
  messageId?: Types.ObjectId;
  attached: boolean;
  createdAt: Date;
}

const schema = new Schema<FileDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ['image', 'file'], required: true },
    width: Number,
    height: Number,
    storageKey: { type: String, required: true },
    thumbKey: String,
    conversationId: Schema.Types.ObjectId,
    messageId: Schema.Types.ObjectId,
    attached: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

schema.index({ ownerId: 1, messageId: 1 });
// Orphan sweeper: unattached uploads by age.
schema.index({ createdAt: 1 }, { partialFilterExpression: { attached: false } });

export const FileModel = model<FileDoc>('File', schema);
