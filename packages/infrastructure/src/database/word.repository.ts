import type {
  PageRequest,
  WordPage,
  WordRepository,
  WordWriteResult,
} from '@english-dictionary/application';

import type { DatabaseClient } from './prisma-client.js';

export class PrismaWordRepository implements WordRepository {
  constructor(private readonly database: DatabaseClient) {}

  async list(search: string, page: PageRequest): Promise<WordPage> {
    const where = {
      deletedAt: null,
      ...(search ? { word: { startsWith: search } } : {}),
    };
    const [records, total] = await this.database.$transaction([
      this.database.word.findMany({
        where,
        orderBy: { word: 'asc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
      }),
      this.database.word.count({ where }),
    ]);

    return {
      words: records.map((record) => record.word),
      total,
    };
  }

  async exists(word: string): Promise<boolean> {
    return (
      (await this.database.word.count({
        where: {
          word,
          deletedAt: null,
        },
      })) > 0
    );
  }

  async insertMany(words: readonly string[]): Promise<WordWriteResult> {
    if (words.length === 0) {
      return { inserted: 0, restored: 0 };
    }

    const [restored, inserted] = await this.database.$transaction([
      this.database.word.updateMany({
        where: {
          word: { in: [...words] },
          deletedAt: { not: null },
        },
        data: { deletedAt: null },
      }),
      this.database.word.createMany({
        data: words.map((word) => ({ word })),
        skipDuplicates: true,
      }),
    ]);

    return {
      inserted: inserted.count,
      restored: restored.count,
    };
  }
}
