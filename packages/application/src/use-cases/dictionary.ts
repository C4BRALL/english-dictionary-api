import type { UserId } from '@english-dictionary/domain';
import { DictionaryWord } from '@english-dictionary/domain';

import { ResourceNotFoundError } from '../errors/application.error.js';
import type { CachedResult, DictionaryEntry } from '../models/dictionary-entry.js';
import { createPageResult, type PageRequest, type PageResult } from '../models/pagination.js';
import type { HistoryRepository } from '../ports/activity.repositories.js';
import type { CacheStore } from '../ports/cache.store.js';
import type { DictionaryGateway } from '../ports/dictionary.gateway.js';
import type { WordRepository } from '../ports/word.repository.js';
import { CacheKeys } from '../services/cache-keys.js';
import { validatePage } from '../services/validation.js';

export interface DictionaryCacheSettings {
  listTtlSeconds: number;
  detailTtlSeconds: number;
}

export class ListWords {
  constructor(
    private readonly words: WordRepository,
    private readonly cache: CacheStore,
    private readonly settings: DictionaryCacheSettings,
  ) {}

  async execute(search: string, page: PageRequest): Promise<CachedResult<PageResult<string>>> {
    const request = validatePage(page);
    const normalizedSearch = search.trim().toLowerCase();
    const key = CacheKeys.words(normalizedSearch, request.page, request.limit);
    const cached = await this.cache.get<PageResult<string>>(key);

    if (cached) {
      return { data: cached, cacheStatus: 'HIT' };
    }

    const result = await this.words.list(normalizedSearch, request);
    const response = createPageResult(result.words, result.total, request);
    await this.cache.set(key, response, this.settings.listTtlSeconds);

    return { data: response, cacheStatus: 'MISS' };
  }
}

export class GetWordDetails {
  constructor(
    private readonly words: WordRepository,
    private readonly dictionary: DictionaryGateway,
    private readonly history: HistoryRepository,
    private readonly cache: CacheStore,
    private readonly settings: DictionaryCacheSettings,
  ) {}

  async execute(userId: UserId, value: string): Promise<CachedResult<DictionaryEntry[]>> {
    const word = DictionaryWord.create(value).value;

    if (!(await this.words.exists(word))) {
      throw new ResourceNotFoundError(`Word "${word}" was not found`);
    }

    const key = CacheKeys.definition(word);
    const cached = await this.cache.get<DictionaryEntry[]>(key);

    if (cached) {
      await this.history.record(userId, word);
      return { data: cached, cacheStatus: 'HIT' };
    }

    const entries = await this.dictionary.find(word);

    if (!entries) {
      throw new ResourceNotFoundError(`Word "${word}" was not found`);
    }

    await this.cache.set(key, entries, this.settings.detailTtlSeconds);
    await this.history.record(userId, word);

    return { data: entries, cacheStatus: 'MISS' };
  }
}
