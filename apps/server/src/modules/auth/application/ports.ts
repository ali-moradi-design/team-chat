export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface TokenIssuer {
  signAccess(userId: string): Promise<string>;
  verifyAccess(token: string): Promise<{ userId: string }>;
  signMedia(userId: string): Promise<string>;
  verifyMedia(token: string): Promise<{ userId: string }>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  rotatedAt?: Date;
}

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Marks a token as used (rotated). */
  rotate(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}
