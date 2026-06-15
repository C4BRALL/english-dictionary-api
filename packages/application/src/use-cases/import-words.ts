import { DictionaryWord, DomainValidationError } from '@english-dictionary/domain';

import type { WordRepository, WordSource } from '../ports/word.repository.js';

export interface ImportWordsResult {
  processed: number;
  inserted: number;
  restored: number;
  skipped: number;
}

export type ImportProgressObserver = (progress: ImportWordsResult) => void;

export class ImportWords {
  constructor(
    private readonly source: WordSource,
    private readonly words: WordRepository,
  ) {}

  async execute(
    batchSize = 5_000,
    onProgress?: ImportProgressObserver,
  ): Promise<ImportWordsResult> {
    let processed = 0;
    let inserted = 0;
    let restored = 0;
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

      const result = await this.words.insertMany([...normalized]);
      inserted += result.inserted;
      restored += result.restored;
      onProgress?.({ processed, inserted, restored, skipped });
    }

    return { processed, inserted, restored, skipped };
  }
}
