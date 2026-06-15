import type { DictionaryEntry, DictionaryGateway } from '@english-dictionary/application';
import { z } from 'zod';

import type { StructuredLogger } from '../observability/structured-logger.js';

const licenseSchema = z.object({
  name: z.string(),
  url: z.string(),
});

const phoneticSchema = z.object({
  text: z.string().optional(),
  audio: z.string().optional(),
  sourceUrl: z.string().optional(),
  license: licenseSchema.optional(),
});

const definitionSchema = z.object({
  definition: z.string(),
  example: z.string().optional(),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
});

const meaningSchema = z.object({
  partOfSpeech: z.string(),
  definitions: z.array(definitionSchema),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
});

const entrySchema = z.object({
  word: z.string(),
  phonetic: z.string().optional(),
  phonetics: z.array(phoneticSchema).default([]),
  meanings: z.array(meaningSchema).default([]),
  license: licenseSchema.optional(),
  sourceUrls: z.array(z.string()).default([]),
});

const responseSchema = z.array(entrySchema);

export type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class DictionaryApiGateway implements DictionaryGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: StructuredLogger,
    private readonly fetcher: Fetcher = globalThis.fetch,
  ) {}

  async find(word: string): Promise<DictionaryEntry[] | null> {
    const startedAt = performance.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v2/entries/en/${encodeURIComponent(word)}`;
    this.logger.info('dictionary_request_started', {
      payload: { word, url },
    });

    try {
      const response = await this.fetcher(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status === 404) {
        this.logger.info('dictionary_request_completed', {
          durationMs: performance.now() - startedAt,
          payload: { word },
          response: { status: 404, found: false },
        });
        return null;
      }

      if (!response.ok) {
        throw new Error(`Dictionary API responded with status ${response.status}`);
      }

      const entries = responseSchema.parse(await response.json());
      this.logger.info('dictionary_request_completed', {
        durationMs: performance.now() - startedAt,
        payload: { word },
        response: summarizeEntries(entries, response.status),
      });
      return entries;
    } catch (error) {
      this.logger.error('dictionary_request_failed', {
        durationMs: performance.now() - startedAt,
        payload: { word, url },
        response: { status: 'failed' },
        error,
      });
      throw error;
    }
  }
}

function summarizeEntries(entries: DictionaryEntry[], status: number): Record<string, unknown> {
  return {
    status,
    entries: entries.length,
    meanings: entries.reduce((total, entry) => total + entry.meanings.length, 0),
    phonetics: entries.reduce((total, entry) => total + entry.phonetics.length, 0),
    sourceUrls: entries.reduce((total, entry) => total + (entry.sourceUrls?.length ?? 0), 0),
    serializedBytes: Buffer.byteLength(JSON.stringify(entries), 'utf8'),
  };
}
