import type { CreateUserInput, UserRepository } from '@english-dictionary/application';
import type { Email, User, UserId } from '@english-dictionary/domain';

import type { DatabaseClient } from './prisma-client.js';
import { toDomainUser } from './mappers.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseClient) {}

  async findByEmail(email: Email): Promise<User | null> {
    const record = await this.database.user.findFirst({
      where: {
        email: email.value,
        deletedAt: null,
      },
    });

    return record ? toDomainUser(record) : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const record = await this.database.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    return record ? toDomainUser(record) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.database.user.findUnique({
      where: { email: input.email.value },
    });
    const data = {
      name: input.name,
      email: input.email.value,
      passwordHash: input.passwordHash,
    };
    const record =
      existing?.deletedAt !== null && existing?.deletedAt !== undefined
        ? await this.database.user.update({
            where: { id: existing.id },
            data: {
              ...data,
              deletedAt: null,
            },
          })
        : await this.database.user.create({ data });

    return toDomainUser(record);
  }
}
