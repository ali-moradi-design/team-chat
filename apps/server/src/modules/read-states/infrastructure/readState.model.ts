import { Schema, model, type Types } from 'mongoose';

export interface ReadStateDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  lastReadMessageId?: Types.ObjectId;
  muted: boolean;
  updatedAt: Date;
}

const schema = new Schema<ReadStateDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    conversationId: { type: Schema.Types.ObjectId, required: true },
    lastReadMessageId: Schema.Types.ObjectId,
    muted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

schema.index({ userId: 1, conversationId: 1 }, { unique: true });
schema.index({ conversationId: 1, userId: 1 });

export const ReadStateModel = model<ReadStateDoc>('ReadState', schema);
