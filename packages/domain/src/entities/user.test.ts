import { describe, expect, it } from 'vitest';

import { Email } from '../value-objects/email.js';
import { User } from './user.js';

describe('User', () => {
  it('exposes a profile without the password hash', () => {
    const createdAt = new Date('2026-06-12T12:00:00.000Z');
    const user = new User({
      id: 'user-1',
      name: 'User 1',
      email: Email.create('user@example.com'),
      passwordHash: 'secret-hash',
      createdAt,
    });

    expect(user.toProfile()).toEqual({
      id: 'user-1',
      name: 'User 1',
      email: 'user@example.com',
      createdAt,
    });
    expect(user.toProfile()).not.toHaveProperty('passwordHash');
  });
});
