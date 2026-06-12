import type { DictionaryEntry } from '../models/dictionary-entry.js';

export interface DictionaryGateway {
  find(word: string): Promise<DictionaryEntry[] | null>;
}
