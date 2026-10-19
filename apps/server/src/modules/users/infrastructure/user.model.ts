import { Schema, model, type Types } from 'mongoose';

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  handle: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'member';
  hue: number;
  isBot: boolean;
  disabled: boolean;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, maxlength: 48 },
    handle: { type: String, required: true, lowercase: true },
    email: { type: String, required: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    hue: { type: Number, required: true },
    isBot: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

userSchema.index({ handle: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

export const UserModel = model<UserDoc>('User', userSchema);
