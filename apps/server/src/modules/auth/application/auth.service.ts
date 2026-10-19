import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { LoginBody, Me, RegisterBody } from '@team-chat/shared';
import { unauthorized } from '../../../lib/errors';
import { toPublicUser, type UserRecord, type UsersService } from '../../users';
import type { PasswordHasher, RefreshTokenRepository, TokenIssuer } from './ports';

const REUSE_GRACE_MS = 10_000;

export interface Session {
  accessToken: string;
  mediaToken: string;
  user: Me;
  /** Present when a new refresh token was minted. Absent in the concurrent-refresh grace case. */
  refreshToken?: string;
  refreshExpiresAt?: Date;
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export const toMe = (u: UserRecord): Me => ({ ...toPublicUser(u), email: u.email });

export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
    private readonly refreshRepo: RefreshTokenRepository,
    private readonly refreshTtlMs: number,
    private readonly onRegistered?: (user: UserRecord) => Promise<void>,
  ) {}

  private dummy?: Promise<string>;
  private dummyHash(): Promise<string> {
    this.dummy ??= this.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummy;
  }

  async register(body: RegisterBody, userAgent?: string): Promise<Session> {
    const passwordHash = await this.hasher.hash(body.password);
    const user = await this.users.create({
      name: body.name,
      handle: body.handle,
      email: body.email,
      passwordHash,
    });
    await this.onRegistered?.(user);
    return this.startSession(user, randomUUID(), userAgent);
  }

  async login(body: LoginBody, userAgent?: string): Promise<Session> {
    const user = await this.users.findAuthByEmail(body.email);
    // Always run a verify to keep timing similar for unknown emails.
    const ok = await this.hasher.verify(
      user?.passwordHash ?? (await this.dummyHash()),
      body.password,
    );
    if (!user || !ok || user.disabled) throw unauthorized('Invalid email or password');
    return this.startSession(user, randomUUID(), userAgent);
  }

  /** Passwordless sign-in for the public demo accounts. Only wired up when DEMO_MODE is on. */
  async loginAsDemo(email: string, userAgent?: string): Promise<Session> {
    const user = await this.users.findAuthByEmail(email);
    if (!user || user.disabled || !email.endsWith('@demo.dev'))
      throw unauthorized('Unknown demo account');
    return this.startSession(user, randomUUID(), userAgent);
  }

  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<Session> {
    if (!refreshToken) throw unauthorized('Missing refresh token');
    const record = await this.refreshRepo.findByHash(hashToken(refreshToken));
    if (!record || record.expiresAt.getTime() < Date.now())
      throw unauthorized('Invalid refresh token');

    if (record.revokedAt) throw unauthorized('Refresh token revoked');

    if (record.rotatedAt) {
      // Already used. A second tab racing the first is fine inside the grace window; anything else
      // looks like token theft, so the whole family is revoked.
      if (Date.now() - record.rotatedAt.getTime() <= REUSE_GRACE_MS) {
        const user = await this.requireUser(record.userId);
        return {
          accessToken: await this.tokens.signAccess(user.id),
          mediaToken: await this.tokens.signMedia(user.id),
          user: toMe(user),
        };
      }
      await this.refreshRepo.revokeFamily(record.familyId);
      throw unauthorized('Refresh token reuse detected');
    }

    const user = await this.requireUser(record.userId);
    await this.refreshRepo.rotate(record.id);
    return this.startSession(user, record.familyId, userAgent);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const record = await this.refreshRepo.findByHash(hashToken(refreshToken));
    if (record) await this.refreshRepo.revokeFamily(record.familyId);
  }

  async authenticate(accessToken: string): Promise<UserRecord> {
    const { userId } = await this.tokens.verifyAccess(accessToken).catch(() => {
      throw unauthorized('Invalid or expired token');
    });
    return this.requireUser(userId);
  }

  async authenticateMedia(mediaToken: string): Promise<UserRecord> {
    const { userId } = await this.tokens.verifyMedia(mediaToken).catch(() => {
      throw unauthorized('Invalid or expired media token');
    });
    return this.requireUser(userId);
  }

  private async requireUser(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user || user.disabled) throw unauthorized('Account not available');
    return user;
  }

  private async startSession(
    user: UserRecord,
    familyId: string,
    userAgent?: string,
  ): Promise<Session> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.refreshRepo.create({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
      userAgent: userAgent?.slice(0, 200),
    });
    return {
      accessToken: await this.tokens.signAccess(user.id),
      mediaToken: await this.tokens.signMedia(user.id),
      user: toMe(user),
      refreshToken,
      refreshExpiresAt,
    };
  }
}
