import type { Email, User, UserId } from '@english-dictionary/domain';

export interface CreateUserInput {
  name: string;
  email: Email;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  findById(id: UserId): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
