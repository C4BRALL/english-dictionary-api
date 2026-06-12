import type { WordSource } from '@english-dictionary/application';
import { z } from 'zod';

import type { Fetcher } from './dictionary-api.gateway.js';

const wordDictionarySchema = z.record(z.string(), z.number());

export class GithubWordSource implements WordSource {
  constructor(
    private readonly url: string,
    private readonly fetcher: Fetcher = globalThis.fetch,
  ) {}

  async *batches(batchSize: number): AsyncIterable<readonly string[]> {
    const response = await this.fetcher(this.url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Word source responded with status ${response.status}`);
    }

    const words = Object.keys(wordDictionarySchema.parse(await response.json()));

    for (let index = 0; index < words.length; index += batchSize) {
      yield words.slice(index, index + batchSize);
    }
  }
}
