import { Email } from '@english-dictionary/domain';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from './prisma-client.js';
import { PrismaFavoriteRepository, PrismaHistoryRepository } from './activity.repositories.js';
import { PrismaUserRepository } from './user.repository.js';
import { PrismaWordRepository } from './word.repository.js';

const userId = '11111111-1111-4111-8111-111111111111';
const wordId = '22222222-2222-4222-8222-222222222222';
const favoriteId = '33333333-3333-4333-8333-333333333333';
const historyId = '44444444-4444-4444-8444-444444444444';
const createdAt = new Date('2026-06-14T12:00:00.000Z');
const updatedAt = new Date('2026-06-14T13:00:00.000Z');
const deletedAt = new Date('2026-06-14T14:00:00.000Z');

describe('PrismaUserRepository', () => {
  it('filters deleted users from lookups', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaUserRepository({
      user: { findFirst },
    } as unknown as DatabaseClient);

    await repository.findByEmail(Email.create('user@example.com'));
    await repository.findById(userId);

    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { email: 'user@example.com', deletedAt: null },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: userId, deletedAt: null },
    });
  });

  it('restores a deleted user during registration', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: userId,
      name: 'Old name',
      email: 'user@example.com',
      passwordHash: 'old-hash',
      createdAt,
      updatedAt,
      deletedAt,
    });
    const update = vi.fn().mockResolvedValue({
      id: userId,
      name: 'New name',
      email: 'user@example.com',
      passwordHash: 'new-hash',
      createdAt,
      updatedAt,
      deletedAt: null,
    });
    const create = vi.fn();
    const repository = new PrismaUserRepository({
      user: { findUnique, update, create },
    } as unknown as DatabaseClient);

    const user = await repository.create({
      name: 'New name',
      email: Email.create('user@example.com'),
      passwordHash: 'new-hash',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        name: 'New name',
        email: 'user@example.com',
        passwordHash: 'new-hash',
        deletedAt: null,
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(user.id).toBe(userId);
  });
});

describe('PrismaWordRepository', () => {
  it('filters deleted words from list and existence checks', async () => {
    const findMany = vi.fn().mockReturnValue('find-many');
    const count = vi.fn().mockReturnValueOnce('count-list').mockResolvedValueOnce(1);
    const transaction = vi.fn().mockResolvedValue([
      [
        {
          id: wordId,
          word: 'fire',
          createdAt,
          updatedAt,
          deletedAt: null,
        },
      ],
      1,
    ]);
    const repository = new PrismaWordRepository({
      word: { findMany, count },
      $transaction: transaction,
    } as unknown as DatabaseClient);

    await expect(repository.list('fi', { page: 1, limit: 10 })).resolves.toEqual({
      words: ['fire'],
      total: 1,
    });
    await expect(repository.exists('fire')).resolves.toBe(true);

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, word: { startsWith: 'fi' } },
      orderBy: { word: 'asc' },
      skip: 0,
      take: 10,
    });
    expect(count).toHaveBeenLastCalledWith({
      where: { word: 'fire', deletedAt: null },
    });
  });

  it('restores deleted words before inserting new ones', async () => {
    const updateMany = vi.fn().mockReturnValue('restore');
    const createMany = vi.fn().mockReturnValue('insert');
    const transaction = vi.fn().mockResolvedValue([{ count: 1 }, { count: 2 }]);
    const repository = new PrismaWordRepository({
      word: { updateMany, createMany },
      $transaction: transaction,
    } as unknown as DatabaseClient);

    await expect(repository.insertMany(['fire', 'firefly'])).resolves.toBe(2);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        word: { in: ['fire', 'firefly'] },
        deletedAt: { not: null },
      },
      data: { deletedAt: null },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ word: 'fire' }, { word: 'firefly' }],
      skipDuplicates: true,
    });
  });
});

describe('PrismaHistoryRepository', () => {
  it('records only active words and keeps history queries append-only', async () => {
    const findFirstOrThrow = vi.fn().mockResolvedValue({
      id: wordId,
      word: 'fire',
      createdAt,
      updatedAt,
      deletedAt: null,
    });
    const create = vi.fn().mockResolvedValue({
      id: historyId,
      userId,
      wordId,
      added: createdAt,
    });
    const findMany = vi.fn().mockReturnValue('find-many');
    const count = vi.fn().mockReturnValue('count');
    const transaction = vi.fn().mockResolvedValue([
      [
        {
          id: historyId,
          userId,
          wordId,
          added: createdAt,
          word: {
            id: wordId,
            word: 'fire',
            createdAt,
            updatedAt,
            deletedAt,
          },
        },
      ],
      1,
    ]);
    const repository = new PrismaHistoryRepository({
      word: { findFirstOrThrow },
      history: { create, findMany, count },
      $transaction: transaction,
    } as unknown as DatabaseClient);

    await repository.record(userId, 'fire');
    await expect(repository.list(userId, { page: 1, limit: 10 })).resolves.toMatchObject({
      results: [{ userId, word: 'fire', added: createdAt }],
      totalDocs: 1,
    });

    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { word: 'fire', deletedAt: null },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        include: { word: true },
      }),
    );
  });
});

describe('PrismaFavoriteRepository', () => {
  it('restores a favorite and uses the last activation as public added date', async () => {
    const findFirstOrThrow = vi.fn().mockResolvedValue({
      id: wordId,
      word: 'fire',
      createdAt,
      updatedAt,
      deletedAt: null,
    });
    const upsert = vi.fn().mockResolvedValue({
      id: favoriteId,
      userId,
      wordId,
      createdAt,
      updatedAt,
      deletedAt: null,
    });
    const findMany = vi.fn().mockReturnValue('find-many');
    const count = vi.fn().mockReturnValue('count');
    const transaction = vi.fn().mockResolvedValue([
      [
        {
          id: favoriteId,
          userId,
          wordId,
          createdAt,
          updatedAt,
          deletedAt: null,
          word: {
            id: wordId,
            word: 'fire',
            createdAt,
            updatedAt,
            deletedAt: null,
          },
        },
      ],
      1,
    ]);
    const repository = new PrismaFavoriteRepository({
      word: { findFirstOrThrow },
      favorite: { upsert, findMany, count },
      $transaction: transaction,
    } as unknown as DatabaseClient);

    await repository.add(userId, 'fire');
    await expect(repository.list(userId, { page: 1, limit: 10 })).resolves.toMatchObject({
      results: [{ userId, word: 'fire', added: updatedAt }],
      totalDocs: 1,
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_wordId: { userId, wordId } },
      create: { userId, wordId },
      update: { deletedAt: null },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          deletedAt: null,
          word: { deletedAt: null },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('soft deletes only active favorites', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: wordId,
      word: 'fire',
      createdAt,
      updatedAt,
      deletedAt: null,
    });
    let softDeletedAt: Date | undefined;
    const updateMany = vi.fn(
      (input: {
        where: { userId: string; wordId: string; deletedAt: null };
        data: { deletedAt: Date };
      }) => {
        softDeletedAt = input.data.deletedAt;
        return Promise.resolve({ count: 1 });
      },
    );
    const repository = new PrismaFavoriteRepository({
      word: { findFirst },
      favorite: { updateMany },
    } as unknown as DatabaseClient);

    await repository.remove(userId, 'fire');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId, wordId, deletedAt: null },
      data: { deletedAt: softDeletedAt },
    });
    expect(softDeletedAt).toBeInstanceOf(Date);
  });
});
