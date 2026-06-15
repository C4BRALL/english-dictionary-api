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

  it('configures Better Stack with production defaults', () => {
    const environment = parseImporterEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/dictionary',
      BETTER_STACK_SOURCE_TOKEN: 'source-token',
      BETTER_STACK_INGESTING_URL: 'https://logs.example.test',
    });

    expect(environment.nodeEnv).toBe('production');
    expect(environment.logging).toEqual({
      level: 'info',
      betterStack: {
        sourceToken: 'source-token',
        ingestingUrl: 'https://logs.example.test',
      },
    });
  });

  it('rejects incomplete Better Stack credentials', () => {
    expect(() =>
      parseImporterEnvironment({
        DATABASE_URL: 'postgresql://localhost/dictionary',
        BETTER_STACK_SOURCE_TOKEN: 'source-token',
      }),
    ).toThrow('Better Stack source token and ingesting URL must be configured together');
  });

  it('treats empty Better Stack values as console-only', () => {
    const environment = parseImporterEnvironment({
      DATABASE_URL: 'postgresql://localhost/dictionary',
      BETTER_STACK_SOURCE_TOKEN: '',
      BETTER_STACK_INGESTING_URL: ' ',
      LOG_LEVEL: 'warn',
    });

    expect(environment.logging).toEqual({
      level: 'warn',
      betterStack: undefined,
    });
  });
});
