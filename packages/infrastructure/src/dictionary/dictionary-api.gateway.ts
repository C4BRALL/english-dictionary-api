import type { DictionaryEntry, DictionaryGateway } from '@english-dictionary/application';
import { z } from 'zod';

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
    private readonly fetcher: Fetcher = globalThis.fetch,
  ) {}

  async find(word: string): Promise<DictionaryEntry[] | null> {
    const response = await this.fetcher(
      `${this.baseUrl.replace(/\/$/, '')}/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Dictionary API responded with status ${response.status}`);
    }

    return responseSchema.parse(await response.json());
  }
}
