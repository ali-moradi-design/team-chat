import type { RefreshTokenRecord, RefreshTokenRepository } from '../application/ports';
import { RefreshTokenModel, type RefreshTokenDoc } from './refreshToken.model';

export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: Parameters<RefreshTokenRepository['create']>[0]): Promise<void> {
    await RefreshTokenModel.create(input);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const d = await RefreshTokenModel.findOne({ tokenHash }).lean<RefreshTokenDoc>();
    if (!d) return null;
    return {
      id: d._id.toString(),
      userId: d.userId.toString(),
      familyId: d.familyId,
      expiresAt: d.expiresAt,
      ...(d.revokedAt ? { revokedAt: d.revokedAt } : {}),
      ...(d.rotatedAt ? { rotatedAt: d.rotatedAt } : {}),
    };
  }

  async rotate(id: string): Promise<void> {
    await RefreshTokenModel.updateOne(
      { _id: id, rotatedAt: { $exists: false } },
      { rotatedAt: new Date() },
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }
}
