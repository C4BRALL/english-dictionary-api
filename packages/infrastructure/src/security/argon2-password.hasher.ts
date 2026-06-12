import type { PasswordHasher } from '@english-dictionary/application';
import { argon2id, hash, verify } from 'argon2';

export class Argon2PasswordHasher implements PasswordHasher {
  hash(value: string): Promise<string> {
    return hash(value, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  verify(passwordHash: string, value: string): Promise<boolean> {
    return verify(passwordHash, value);
  }
}
