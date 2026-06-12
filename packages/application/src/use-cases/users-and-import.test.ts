import { Email, User } from '@english-dictionary/domain';
import { describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError, ValidationError } from '../errors/application.error.js';
import { createPageResult, type PageRequest } from '../models/pagination.js';
import type { FavoriteRepository, HistoryRepository } from '../ports/activity.repositories.js';
import type { UserRepository } from '../ports/user.repository.js';
import type { WordRepository, WordSource } from '../ports/word.repository.js';
import { ImportWords } from './import-words.js';
import { GetUserProfile, ListFavorites, ListHistory } from './users.js';

class Users implements UserRepository {
  constructor(private readonly user: User | null) {}

  findByEmail(): Promise<User | null> {
    return Promise.resolve(this.user);
  }

  findById(): Promise<User | null> {
    return Promise.resolve(this.user);
  }

  create(): Promise<User> {
    throw new Error('Not used in this test');
  }
}

function createActivities(): {
  history: HistoryRepository;
  favorites: FavoriteRepository;
} {
  return {
    history: {
      record: vi.fn(() => Promise.resolve()),
      list: vi.fn((userId: string, page: PageRequest) => {
        void userId;
        return Promise.resolve(createPageResult([], 0, page));
      }),
    },
    favorites: {
      add: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      list: vi.fn((userId: string, page: PageRequest) => {
        void userId;
        return Promise.resolve(createPageResult([], 0, page));
      }),
    },
  };
}

describe('user and import use cases', () => {
  it('returns a public user profile', async () => {
    const user = new User({
      id: 'user-1',
      name: 'User 1',
      email: Email.create('user@example.com'),
      passwordHash: 'hash',
      createdAt: new Date('2026-06-12T12:00:00.000Z'),
    });

    await expect(new GetUserProfile(new Users(user)).execute(user.id)).resolves.toEqual(
      user.toProfile(),
    );
  });

  it('fails when a profile does not exist', async () => {
    await expect(new GetUserProfile(new Users(null)).execute('missing')).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it('validates pagination before loading activities', async () => {
    const activities = createActivities();

    await new ListHistory(activities.history).execute('user-1', { page: 1, limit: 10 });
    await new ListFavorites(activities.favorites).execute('user-1', { page: 1, limit: 10 });
    await expect(
      new ListHistory(activities.history).execute('user-1', { page: 0, limit: 101 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('normalizes, deduplicates, and skips invalid imported words', async () => {
    const source: WordSource = {
      async *batches(): AsyncIterable<readonly string[]> {
        await Promise.resolve();
        yield ['Fire', 'fire', 'two words'];
        yield ['water'];
      },
    };
    const insertedBatches: string[][] = [];
    const words: WordRepository = {
      list: vi.fn(() => Promise.resolve({ words: [], total: 0 })),
      exists: vi.fn(() => Promise.resolve(false)),
      insertMany: vi.fn((batch: readonly string[]) => {
        insertedBatches.push([...batch]);
        return Promise.resolve(batch.length);
      }),
    };

    await expect(new ImportWords(source, words).execute(2)).resolves.toEqual({
      processed: 4,
      inserted: 2,
      skipped: 1,
    });
    expect(insertedBatches).toEqual([['fire'], ['water']]);
  });
});
