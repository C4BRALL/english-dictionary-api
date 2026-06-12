import { Email, User } from '@english-dictionary/domain';

import type { UserModel } from '../generated/prisma/models/User.js';

export function toDomainUser(record: UserModel): User {
  return new User({
    id: record.id,
    name: record.name,
    email: Email.create(record.email),
    passwordHash: record.passwordHash,
    createdAt: record.createdAt,
  });
}
