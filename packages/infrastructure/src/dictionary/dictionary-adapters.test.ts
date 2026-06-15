import { describe, expect, it, vi } from 'vitest';

import type { StructuredLogger } from '../observability/structured-logger.js';
import { DictionaryApiGateway, type Fetcher } from './dictionary-api.gateway.js';
import { GithubWordSource } from './github-word.source.js';

function createLogger(): StructuredLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as StructuredLogger;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('dictionary adapters', () => {
  it('validates and maps a Dictionary API response', async () => {
    const fetcher: Fetcher = vi.fn(() =>
      Promise.resolve(
        response([
          {
            word: 'fire',
            phonetics: [],
            meanings: [
              {
                partOfSpeech: 'noun',
                definitions: [{ definition: 'combustion' }],
              },
            ],
            sourceUrls: [],
          },
        ]),
      ),
    );

    await expect(
      new DictionaryApiGateway('https://example.test/', createLogger(), fetcher).find('fire'),
    ).resolves.toEqual([
      {
        word: 'fire',
        phonetics: [],
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'combustion',
                synonyms: [],
                antonyms: [],
              },
            ],
            synonyms: [],
            antonyms: [],
          },
        ],
        sourceUrls: [],
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/api/v2/entries/en/fire',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('maps a 404 to a missing word and rejects upstream failures', async () => {
    const missing: Fetcher = vi.fn(() => Promise.resolve(response({}, 404)));
    const failing: Fetcher = vi.fn(() => Promise.resolve(response({}, 503)));

    await expect(
      new DictionaryApiGateway('https://example.test', createLogger(), missing).find('missing'),
    ).resolves.toBeNull();
    await expect(
      new DictionaryApiGateway('https://example.test', createLogger(), failing).find('fire'),
    ).rejects.toThrow('status 503');
  });

  it('downloads and yields deterministic word batches', async () => {
    const source = new GithubWordSource(
      'https://example.test/words.json',
      vi.fn(() => Promise.resolve(response({ fire: 1, water: 1, wind: 1 }))),
    );
    const batches: string[][] = [];

    for await (const batch of source.batches(2)) {
      batches.push([...batch]);
    }

    expect(batches).toEqual([['fire', 'water'], ['wind']]);
  });

  it('rejects word-source HTTP failures', async () => {
    const source = new GithubWordSource(
      'https://example.test/words.json',
      vi.fn(() => Promise.resolve(response({}, 500))),
    );

    await expect(async () => {
      for await (const batch of source.batches(2)) {
        void batch;
        // The source fails before yielding.
      }
    }).rejects.toThrow('status 500');
  });
});
