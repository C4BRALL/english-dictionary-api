import { describe, expect, it } from 'vitest';

import { DomainValidationError } from '../errors/domain-validation.error.js';
import { Email } from './email.js';

describe('Email', () => {
  it('normalizes a valid email', () => {
    const email = Email.create('  User@Example.COM ');

    expect(email.value).toBe('user@example.com');
  });

  it.each(['invalid', '@example.com', 'user@', 'user @example.com'])(
    'rejects invalid email %s',
    (value) => {
      expect(() => Email.create(value)).toThrow(DomainValidationError);
    },
  );

  it('compares normalized values', () => {
    expect(Email.create('USER@example.com').equals(Email.create('user@example.com'))).toBe(true);
  });

  it('returns its normalized string representation', () => {
    expect(Email.create('USER@example.com').toString()).toBe('user@example.com');
  });
});
