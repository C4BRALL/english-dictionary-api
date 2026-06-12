import type { PageRequest, WordPage, WordRepository } from '@english-dictionary/application';

import type { DatabaseClient } from './prisma-client.js';

export class PrismaWordRepository implements WordRepository {
  constructor(private readonly database: DatabaseClient) {}

  async list(search: string, page: PageRequest): Promise<WordPage> {
    const where = search ? { word: { startsWith: search } } : undefined;
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
    return (await this.database.word.count({ where: { word } })) > 0;
  }

  async insertMany(words: readonly string[]): Promise<number> {
    if (words.length === 0) {
      return 0;
    }

    const result = await this.database.word.createMany({
      data: words.map((word) => ({ word })),
      skipDuplicates: true,
    });

    return result.count;
  }
}
