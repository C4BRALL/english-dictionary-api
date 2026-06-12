import { DictionaryWord, DomainValidationError } from '@english-dictionary/domain';

import type { WordRepository, WordSource } from '../ports/word.repository.js';

export interface ImportWordsResult {
  processed: number;
  inserted: number;
  skipped: number;
}

export class ImportWords {
  constructor(
    private readonly source: WordSource,
    private readonly words: WordRepository,
  ) {}

  async execute(batchSize = 5_000): Promise<ImportWordsResult> {
    let processed = 0;
    let inserted = 0;
    let skipped = 0;

    for await (const batch of this.source.batches(batchSize)) {
      const normalized = new Set<string>();

      for (const value of batch) {
        processed += 1;

        try {
          normalized.add(DictionaryWord.create(value).value);
        } catch (error) {
          if (!(error instanceof DomainValidationError)) {
            throw error;
          }
          skipped += 1;
        }
      }

      inserted += await this.words.insertMany([...normalized]);
    }

    return { processed, inserted, skipped };
  }
}
