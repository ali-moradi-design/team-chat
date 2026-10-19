import { SignJWT, jwtVerify } from 'jose';
import type { TokenIssuer } from '../application/ports';

const ISSUER = 'team-chat';

export class JwtTokenIssuer implements TokenIssuer {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly accessTtlSec: number,
    private readonly mediaTtlSec = 12 * 3600,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  private sign(userId: string, typ: 'access' | 'media', ttl: number): Promise<string> {
    return new SignJWT({ typ })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .sign(this.key);
  }

  signAccess = (userId: string) => this.sign(userId, 'access', this.accessTtlSec);
  signMedia = (userId: string) => this.sign(userId, 'media', this.mediaTtlSec);

  private async verify(token: string, typ: 'access' | 'media'): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
    if (payload.typ !== typ || !payload.sub) throw new Error('wrong token type');
    return { userId: payload.sub };
  }

  verifyAccess = (token: string) => this.verify(token, 'access');
  verifyMedia = (token: string) => this.verify(token, 'media');
}
