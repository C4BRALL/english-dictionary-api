import {
  createPageResult,
  type FavoriteRepository,
  type HistoryRepository,
  type PageRequest,
  type PageResult,
} from '@english-dictionary/application';
import type { FavoriteEntry, HistoryEntry, UserId } from '@english-dictionary/domain';

import type { DatabaseClient } from './prisma-client.js';

export class PrismaHistoryRepository implements HistoryRepository {
  constructor(private readonly database: DatabaseClient) {}

  async record(userId: UserId, word: string): Promise<void> {
    await this.database.history.create({
      data: {
        user: {
          connect: { id: userId },
        },
        word: {
          connect: { word },
        },
      },
    });
  }

  async list(userId: UserId, page: PageRequest): Promise<PageResult<HistoryEntry>> {
    const where = { userId };
    const [records, total] = await this.database.$transaction([
      this.database.history.findMany({
        where,
        include: { word: true },
        orderBy: { added: 'desc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
      }),
      this.database.history.count({ where }),
    ]);

    return createPageResult(
      records.map((record) => ({
        userId: record.userId,
        word: record.word.word,
        added: record.added,
      })),
      total,
      page,
    );
  }
}

export class PrismaFavoriteRepository implements FavoriteRepository {
  constructor(private readonly database: DatabaseClient) {}

  async add(userId: UserId, word: string): Promise<void> {
    const dictionaryWord = await this.database.word.findUniqueOrThrow({ where: { word } });

    await this.database.favorite.upsert({
      where: {
        userId_wordId: {
          userId,
          wordId: dictionaryWord.id,
        },
      },
      create: {
        userId,
        wordId: dictionaryWord.id,
      },
      update: {},
    });
  }

  async remove(userId: UserId, word: string): Promise<void> {
    const dictionaryWord = await this.database.word.findUnique({ where: { word } });

    if (!dictionaryWord) {
      return;
    }

    await this.database.favorite.deleteMany({
      where: {
        userId,
        wordId: dictionaryWord.id,
      },
    });
  }

  async list(userId: UserId, page: PageRequest): Promise<PageResult<FavoriteEntry>> {
    const where = { userId };
    const [records, total] = await this.database.$transaction([
      this.database.favorite.findMany({
        where,
        include: { word: true },
        orderBy: { added: 'desc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
      }),
      this.database.favorite.count({ where }),
    ]);

    return createPageResult(
      records.map((record) => ({
        userId: record.userId,
        word: record.word.word,
        added: record.added,
      })),
      total,
      page,
    );
  }
}
