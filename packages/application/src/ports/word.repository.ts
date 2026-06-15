import type { PageRequest } from '../models/pagination.js';

export interface WordPage {
  words: string[];
  total: number;
}

export interface WordWriteResult {
  inserted: number;
  restored: number;
}

export interface WordRepository {
  list(search: string, page: PageRequest): Promise<WordPage>;
  exists(word: string): Promise<boolean>;
  insertMany(words: readonly string[]): Promise<WordWriteResult>;
}

export interface WordSource {
  batches(batchSize: number): AsyncIterable<readonly string[]>;
}
