import { Schema, model, type Types } from 'mongoose';

export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  rotatedAt?: Date;
  userAgent?: string;
  createdAt: Date;
}

const schema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    rotatedAt: Date,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ familyId: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup

export const RefreshTokenModel = model<RefreshTokenDoc>('RefreshToken', schema);
