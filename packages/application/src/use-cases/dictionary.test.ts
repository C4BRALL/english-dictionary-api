import { describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '../errors/application.error.js';
import type { DictionaryEntry } from '../models/dictionary-entry.js';
import type { PageResult } from '../models/pagination.js';
import type { HistoryRepository } from '../ports/activity.repositories.js';
import type { CacheStore } from '../ports/cache.store.js';
import type { DictionaryGateway } from '../ports/dictionary.gateway.js';
import type { WordRepository } from '../ports/word.repository.js';
import { GetWordDetails, ListWords } from './dictionary.js';

class MemoryCache implements CacheStore {
  readonly values = new Map<string, unknown>();

  get<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.values.get(key) as T | undefined) ?? null);
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    void ttlSeconds;
    this.values.set(key, value);
    return Promise.resolve();
  }
}

const entry: DictionaryEntry = {
  word: 'fire',
  phonetics: [],
  meanings: [],
  sourceUrls: [],
};

function createWordRepository(): WordRepository {
  return {
    list: vi.fn(() => Promise.resolve({ words: ['fire', 'firefly'], total: 2 })),
    exists: vi.fn(() => Promise.resolve(true)),
    insertMany: vi.fn(() => Promise.resolve(0)),
  };
}

function createHistory(): HistoryRepository {
  return {
    record: vi.fn(() => Promise.resolve()),
    list: vi.fn(() =>
      Promise.resolve({
        results: [],
        totalDocs: 0,
        page: 1,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }),
    ),
  };
}

describe('dictionary use cases', () => {
  it('returns and caches a word page', async () => {
    const words = createWordRepository();
    const cache = new MemoryCache();
    const useCase = new ListWords(words, cache, { listTtlSeconds: 60, detailTtlSeconds: 60 });

    const first = await useCase.execute(' Fire ', { page: 1, limit: 10 });
    const second = await useCase.execute('fire', { page: 1, limit: 10 });

    expect(first).toEqual({
      cacheStatus: 'MISS',
      data: {
        results: ['fire', 'firefly'],
        totalDocs: 2,
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    expect(second.cacheStatus).toBe('HIT');
    expect(words.list).toHaveBeenCalledTimes(1);
  });

  it('returns a cached definition and still records history', async () => {
    const words = createWordRepository();
    const cache = new MemoryCache();
    await cache.set('definition:fire', [entry], 60);
    const history = createHistory();
    const gateway: DictionaryGateway = { find: vi.fn(() => Promise.resolve(null)) };
    const useCase = new GetWordDetails(words, gateway, history, cache, {
      listTtlSeconds: 60,
      detailTtlSeconds: 60,
    });

    await expect(useCase.execute('user-1', 'Fire')).resolves.toEqual({
      data: [entry],
      cacheStatus: 'HIT',
    });
    expect(history.record).toHaveBeenCalledWith('user-1', 'fire');
    expect(gateway.find).not.toHaveBeenCalled();
  });

  it('proxies, caches, and records a definition on cache miss', async () => {
    const words = createWordRepository();
    const cache = new MemoryCache();
    const history = createHistory();
    const gateway: DictionaryGateway = { find: vi.fn(() => Promise.resolve([entry])) };
    const useCase = new GetWordDetails(words, gateway, history, cache, {
      listTtlSeconds: 60,
      detailTtlSeconds: 60,
    });

    const result = await useCase.execute('user-1', 'fire');

    expect(result.cacheStatus).toBe('MISS');
    expect(await cache.get<DictionaryEntry[]>('definition:fire')).toEqual([entry]);
    expect(history.record).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('does not record history for an unknown word', async () => {
    const words = createWordRepository();
    const history = createHistory();
    const gateway: DictionaryGateway = { find: vi.fn(() => Promise.resolve(null)) };
    const useCase = new GetWordDetails(words, gateway, history, new MemoryCache(), {
      listTtlSeconds: 60,
      detailTtlSeconds: 60,
    });

    await expect(useCase.execute('user-1', 'missing')).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(history.record).not.toHaveBeenCalled();
  });

  it('rejects an inactive word before cache or external lookup', async () => {
    const words = createWordRepository();
    vi.mocked(words.exists).mockResolvedValue(false);
    const cache = new MemoryCache();
    await cache.set('definition:fire', [entry], 60);
    const history = createHistory();
    const gateway: DictionaryGateway = { find: vi.fn(() => Promise.resolve([entry])) };
    const useCase = new GetWordDetails(words, gateway, history, cache, {
      listTtlSeconds: 60,
      detailTtlSeconds: 60,
    });

    await expect(useCase.execute('user-1', 'fire')).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(gateway.find).not.toHaveBeenCalled();
    expect(history.record).not.toHaveBeenCalled();
  });

  it('computes navigation metadata for later pages', async () => {
    const cache = new MemoryCache();
    const expected: PageResult<string> = {
      results: ['word'],
      totalDocs: 21,
      page: 2,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    };
    const words: WordRepository = {
      list: vi.fn(() => Promise.resolve({ words: expected.results, total: expected.totalDocs })),
      exists: vi.fn(() => Promise.resolve(true)),
      insertMany: vi.fn(() => Promise.resolve(0)),
    };

    await expect(
      new ListWords(words, cache, { listTtlSeconds: 60, detailTtlSeconds: 60 }).execute('', {
        page: 2,
        limit: 10,
      }),
    ).resolves.toMatchObject({ data: expected });
  });
});
