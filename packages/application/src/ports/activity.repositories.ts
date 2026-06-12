import type { FavoriteEntry, HistoryEntry, UserId } from '@english-dictionary/domain';

import type { PageRequest, PageResult } from '../models/pagination.js';

export interface HistoryRepository {
  record(userId: UserId, word: string): Promise<void>;
  list(userId: UserId, page: PageRequest): Promise<PageResult<HistoryEntry>>;
}

export interface FavoriteRepository {
  add(userId: UserId, word: string): Promise<void>;
  remove(userId: UserId, word: string): Promise<void>;
  list(userId: UserId, page: PageRequest): Promise<PageResult<FavoriteEntry>>;
}
