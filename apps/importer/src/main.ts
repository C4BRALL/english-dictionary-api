import { ImportWords } from '@english-dictionary/application';
import {
  createPrismaClient,
  GithubWordSource,
  PrismaWordRepository,
} from '@english-dictionary/infrastructure';

import { parseImporterEnvironment } from './environment.js';

async function run(): Promise<void> {
  const environment = parseImporterEnvironment(process.env);
  const database = createPrismaClient(environment.databaseUrl);
  const source = new GithubWordSource(environment.sourceUrl);
  const words = new PrismaWordRepository(database);
  const importer = new ImportWords(source, words);
  const startedAt = performance.now();

  try {
    console.info(
      JSON.stringify({
        event: 'dictionary_import_started',
        batchSize: environment.batchSize,
        sourceUrl: environment.sourceUrl,
      }),
    );

    const result = await importer.execute(environment.batchSize);

    console.info(
      JSON.stringify({
        event: 'dictionary_import_completed',
        durationMs: Math.round(performance.now() - startedAt),
        ...result,
      }),
    );
  } finally {
    await database.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'dictionary_import_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
