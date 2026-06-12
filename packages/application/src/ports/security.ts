import type { UserId } from '@english-dictionary/domain';

export interface PasswordHasher {
  hash(value: string): Promise<string>;
  verify(hash: string, value: string): Promise<boolean>;
}

export interface TokenIssuer {
  issue(subject: UserId): Promise<string>;
}
