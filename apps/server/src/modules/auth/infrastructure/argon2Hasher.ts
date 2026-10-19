import argon2 from 'argon2';
import type { PasswordHasher } from '../application/ports';

export class Argon2Hasher implements PasswordHasher {
  constructor(private readonly fast = false) {}

  hash(plain: string): Promise<string> {
    // OWASP minimum for argon2id: 19 MiB, t=2, p=1. Tests use cheaper params.
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.fast ? 1024 : 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
