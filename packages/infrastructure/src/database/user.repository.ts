import type { CreateUserInput, UserRepository } from '@english-dictionary/application';
import type { Email, User, UserId } from '@english-dictionary/domain';

import type { DatabaseClient } from './prisma-client.js';
import { toDomainUser } from './mappers.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.database.user.findUnique({
      where: { email: email.value },
    });

    return record ? toDomainUser(record) : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const record = await this.database.user.findUnique({ where: { id } });
    return record ? toDomainUser(record) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const record = await this.database.user.create({
      data: {
        name: input.name,
        email: input.email.value,
        passwordHash: input.passwordHash,
      },
    });

    return toDomainUser(record);
  }
}
