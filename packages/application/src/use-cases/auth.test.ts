import { Email, User, type UserProps } from '@english-dictionary/domain';
import { describe, expect, it, vi } from 'vitest';

import {
  ConflictError,
  InvalidCredentialsError,
  ValidationError,
} from '../errors/application.error.js';
import type { PasswordHasher, TokenIssuer } from '../ports/security.js';
import type { CreateUserInput, UserRepository } from '../ports/user.repository.js';
import { SignIn, SignUp } from './auth.js';

class UserBuilder {
  private props: UserProps = {
    id: 'user-1',
    name: 'User 1',
    email: Email.create('user@example.com'),
    passwordHash: 'hashed:password123',
    createdAt: new Date('2026-06-12T12:00:00.000Z'),
  };

  withEmail(value: string): this {
    this.props = { ...this.props, email: Email.create(value) };
    return this;
  }

  withPasswordHash(value: string): this {
    this.props = { ...this.props, passwordHash: value };
    return this;
  }

  build(): User {
    return new User(this.props);
  }
}

class FakeUserRepository implements UserRepository {
  readonly users: User[] = [];

  findByEmail(email: Email): Promise<User | null> {
    return Promise.resolve(this.users.find((user) => user.email.equals(email)) ?? null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  create(input: CreateUserInput): Promise<User> {
    const user = new User({
      id: `user-${this.users.length + 1}`,
      ...input,
      createdAt: new Date('2026-06-12T12:00:00.000Z'),
    });
    this.users.push(user);
    return Promise.resolve(user);
  }
}

function createSecurity(): {
  hasher: PasswordHasher;
  tokens: TokenIssuer;
} {
  return {
    hasher: {
      hash: vi.fn((value: string) => Promise.resolve(`hashed:${value}`)),
      verify: vi.fn((hash: string, value: string) => Promise.resolve(hash === `hashed:${value}`)),
    },
    tokens: {
      issue: vi.fn((subject: string) => Promise.resolve(`token-for:${subject}`)),
    },
  };
}

describe('authentication use cases', () => {
  it('registers a normalized user and returns a bearer token', async () => {
    const users = new FakeUserRepository();
    const { hasher, tokens } = createSecurity();
    const signUp = new SignUp(users, hasher, tokens);

    await expect(
      signUp.execute({
        name: ' User 1 ',
        email: 'USER@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      name: 'User 1',
      token: 'Bearer token-for:user-1',
    });
    expect(users.users[0]?.email.value).toBe('user@example.com');
  });

  it('rejects duplicate users and weak input', async () => {
    const users = new FakeUserRepository();
    const security = createSecurity();
    const signUp = new SignUp(users, security.hasher, security.tokens);
    await signUp.execute({
      name: 'User 1',
      email: 'user@example.com',
      password: 'password123',
    });

    await expect(
      signUp.execute({
        name: 'User 2',
        email: 'USER@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      signUp.execute({ name: 'x', email: 'other@example.com', password: 'short' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('signs in a user with valid credentials', async () => {
    const users = new FakeUserRepository();
    const security = createSecurity();
    const user = new UserBuilder().build();
    users.users.push(user);
    const signIn = new SignIn(users, security.hasher, security.tokens);

    await expect(
      signIn.execute({ email: user.email.value, password: 'password123' }),
    ).resolves.toEqual({
      id: user.id,
      name: user.name,
      token: `Bearer token-for:${user.id}`,
    });
  });

  it('does not disclose whether the user or password is invalid', async () => {
    const users = new FakeUserRepository();
    const security = createSecurity();
    users.users.push(
      new UserBuilder()
        .withEmail('user@example.com')
        .withPasswordHash('hashed:password123')
        .build(),
    );
    const signIn = new SignIn(users, security.hasher, security.tokens);

    await expect(
      signIn.execute({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toEqual(new InvalidCredentialsError());
    await expect(
      signIn.execute({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toEqual(new InvalidCredentialsError());
  });
});
