import { randomUUID } from 'node:crypto';

import { ImportWords } from '@english-dictionary/application';
import {
  createStructuredLogger,
  createPrismaClient,
  GithubWordSource,
  PrismaWordRepository,
  runWithTransaction,
} from '@english-dictionary/infrastructure';

import { parseImporterEnvironment } from './environment.js';

async function run(): Promise<void> {
  const environment = parseImporterEnvironment(process.env);
  const logger = createStructuredLogger({
    service: 'importer',
    environment: environment.nodeEnv,
    ...environment.logging,
  });
  const database = createPrismaClient(environment.databaseUrl);
  const source = new GithubWordSource(environment.sourceUrl);
  const words = new PrismaWordRepository(database);
  const importer = new ImportWords(source, words);
  const startedAt = performance.now();
  let progress = { processed: 0, inserted: 0, restored: 0, skipped: 0 };

  await runWithTransaction({ transactionId: randomUUID() }, async () => {
    try {
      logger.info('dictionary_import_started', {
        payload: {
          batchSize: environment.batchSize,
          sourceUrl: environment.sourceUrl,
        },
        response: { status: 'started' },
      });

      const result = await importer.execute(environment.batchSize, (currentProgress) => {
        progress = currentProgress;
        logger.info('dictionary_import_progress', {
          payload: { batchSize: environment.batchSize },
          response: currentProgress,
        });
      });

      logger.info('dictionary_import_completed', {
        durationMs: Math.round(performance.now() - startedAt),
        payload: {
          batchSize: environment.batchSize,
          sourceUrl: environment.sourceUrl,
        },
        response: { status: 'completed', ...result },
      });
    } catch (error) {
      logger.error('dictionary_import_failed', {
        durationMs: Math.round(performance.now() - startedAt),
        payload: {
          batchSize: environment.batchSize,
          sourceUrl: environment.sourceUrl,
        },
        response: { status: 'failed', ...progress },
        error,
      });
      throw error;
    } finally {
      await database.$disconnect();
      await logger.flush();
    }
  });
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown importer error');
  process.exitCode = 1;
});
