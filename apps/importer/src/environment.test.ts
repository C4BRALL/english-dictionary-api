import { describe, expect, it } from 'vitest';

import { parseImporterEnvironment } from './environment.js';

describe('parseImporterEnvironment', () => {
  it('applies safe importer defaults', () => {
    const environment = parseImporterEnvironment({
      DATABASE_URL: 'postgresql://localhost/dictionary',
    });

    expect(environment.batchSize).toBe(5_000);
    expect(environment.sourceUrl).toContain('words_dictionary.json');
  });

  it('rejects unbounded batch sizes', () => {
    expect(() =>
      parseImporterEnvironment({
        DATABASE_URL: 'postgresql://localhost/dictionary',
        IMPORT_BATCH_SIZE: '50000',
      }),
    ).toThrow();
  });
});
