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
    const dictionaryWord = await this.database.word.findFirstOrThrow({
      where: {
        word,
        deletedAt: null,
      },
    });

    await this.database.history.create({
      data: {
        userId,
        wordId: dictionaryWord.id,
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
    const dictionaryWord = await this.database.word.findFirstOrThrow({
      where: {
        word,
        deletedAt: null,
      },
    });

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
      update: {
        deletedAt: null,
      },
    });
  }

  async remove(userId: UserId, word: string): Promise<void> {
    const dictionaryWord = await this.database.word.findFirst({
      where: {
        word,
        deletedAt: null,
      },
    });

    if (!dictionaryWord) {
      return;
    }

    await this.database.favorite.updateMany({
      where: {
        userId,
        wordId: dictionaryWord.id,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }

  async list(userId: UserId, page: PageRequest): Promise<PageResult<FavoriteEntry>> {
    const where = {
      userId,
      deletedAt: null,
      word: {
        deletedAt: null,
      },
    };
    const [records, total] = await this.database.$transaction([
      this.database.favorite.findMany({
        where,
        include: { word: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
      }),
      this.database.favorite.count({ where }),
    ]);

    return createPageResult(
      records.map((record) => ({
        userId: record.userId,
        word: record.word.word,
        added: record.updatedAt,
      })),
      total,
      page,
    );
  }
}
