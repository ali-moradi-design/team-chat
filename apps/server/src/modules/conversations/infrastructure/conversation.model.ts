import { Schema, model, type Types } from 'mongoose';

export interface ConversationDoc {
  _id: Types.ObjectId;
  type: 'channel' | 'dm';
  name?: string;
  nameKey?: string;
  dmKey?: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  members: Array<{ userId: Types.ObjectId; role: 'owner' | 'member'; joinedAt: Date }>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  lastMessageAt?: Date;
  lastMessage?: { id: Types.ObjectId; authorId: Types.ObjectId; text: string; createdAt: Date };
}

const schema = new Schema<ConversationDoc>(
  {
    type: { type: String, enum: ['channel', 'dm'], required: true },
    name: String,
    nameKey: String,
    dmKey: String,
    topic: String,
    description: String,
    isPrivate: { type: Boolean, default: false },
    members: [
      new Schema(
        {
          userId: { type: Schema.Types.ObjectId, required: true },
          role: { type: String, enum: ['owner', 'member'], default: 'member' },
          joinedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
    ],
    createdBy: { type: Schema.Types.ObjectId, required: true },
    lastMessageAt: Date,
    lastMessage: new Schema(
      {
        id: Schema.Types.ObjectId,
        authorId: Schema.Types.ObjectId,
        text: String,
        createdAt: Date,
      },
      { _id: false },
    ),
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Sidebar: "my conversations, most recently active first".
schema.index({ 'members.userId': 1, lastMessageAt: -1 });
// Channel names are unique (case-insensitive); DMs are unique per set of people.
schema.index({ nameKey: 1 }, { unique: true, partialFilterExpression: { type: 'channel' } });
schema.index({ dmKey: 1 }, { unique: true, partialFilterExpression: { type: 'dm' } });
// "Browse channels".
schema.index({ type: 1, isPrivate: 1, nameKey: 1 });

export const ConversationModel = model<ConversationDoc>('Conversation', schema);
