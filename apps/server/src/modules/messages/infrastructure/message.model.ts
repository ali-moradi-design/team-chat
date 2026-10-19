import { Schema, model, type Types } from 'mongoose';

export interface MessageDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  attachments: Array<{
    fileId: Types.ObjectId;
    name: string;
    mime: string;
    size: number;
    kind: 'image' | 'file';
    width?: number;
    height?: number;
  }>;
  reactions: Array<{ emoji: string; userIds: Types.ObjectId[] }>;
  mentions: Types.ObjectId[];
  mentionsAll: boolean;
  threadRootId?: Types.ObjectId;
  replyCount: number;
  lastReplyAt?: Date;
  pinned: boolean;
  pinnedAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;
  clientMsgId?: string;
  createdAt: Date;
}

const schema = new Schema<MessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, default: '' },
    attachments: [
      new Schema(
        {
          fileId: { type: Schema.Types.ObjectId, required: true },
          name: String,
          mime: String,
          size: Number,
          kind: { type: String, enum: ['image', 'file'] },
          width: Number,
          height: Number,
        },
        { _id: false },
      ),
    ],
    reactions: [
      new Schema(
        { emoji: { type: String, required: true }, userIds: [{ type: Schema.Types.ObjectId }] },
        { _id: false },
      ),
    ],
    mentions: [{ type: Schema.Types.ObjectId }],
    mentionsAll: { type: Boolean, default: false },
    threadRootId: Schema.Types.ObjectId,
    replyCount: { type: Number, default: 0 },
    lastReplyAt: Date,
    pinned: { type: Boolean, default: false },
    pinnedAt: Date,
    editedAt: Date,
    deletedAt: Date,
    clientMsgId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// History pages: equality on (conversation, threadRoot=null) then a range scan on _id.
schema.index({ conversationId: 1, threadRootId: 1, _id: -1 });
// Thread view.
schema.index(
  { threadRootId: 1, _id: 1 },
  { partialFilterExpression: { threadRootId: { $exists: true } } },
);
// Pins.
schema.index({ conversationId: 1, pinnedAt: -1 }, { partialFilterExpression: { pinned: true } });
// Idempotent send: one clientMsgId per author per conversation.
schema.index(
  { conversationId: 1, authorId: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $exists: true } } },
);
// Unread/mention counters.
schema.index({ conversationId: 1, mentions: 1, _id: -1 });
// Full-text search (language "none": no stemming, works for Persian and English alike).
schema.index({ text: 'text' }, { default_language: 'none', name: 'message_text' });

export const MessageModel = model<MessageDoc>('Message', schema);
