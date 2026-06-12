import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from './argon2-password.hasher.js';
import { JwtTokenService } from './jwt-token.service.js';

describe('security adapters', () => {
  it('hashes and verifies passwords with Argon2id', async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash('password123');

    expect(hash).not.toContain('password123');
    await expect(hasher.verify(hash, 'password123')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('issues and verifies signed JWT subjects', async () => {
    const tokens = new JwtTokenService({
      secret: 'a-secure-test-secret-that-is-long-enough',
      issuer: 'english-dictionary-api',
      audience: 'english-dictionary-client',
      expiresIn: '15m',
    });

    const token = await tokens.issue('user-1');

    await expect(tokens.verify(token)).resolves.toBe('user-1');
  });

  it('rejects a token signed with another key', async () => {
    const issuer = new JwtTokenService({
      secret: 'first-secure-test-secret-that-is-long-enough',
      issuer: 'english-dictionary-api',
      audience: 'english-dictionary-client',
      expiresIn: '15m',
    });
    const verifier = new JwtTokenService({
      secret: 'second-secure-test-secret-that-is-long-enough',
      issuer: 'english-dictionary-api',
      audience: 'english-dictionary-client',
      expiresIn: '15m',
    });

    await expect(verifier.verify(await issuer.issue('user-1'))).rejects.toThrow();
  });
});
