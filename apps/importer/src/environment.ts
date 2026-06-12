import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WORDS_SOURCE_URL: z
    .string()
    .url()
    .default('https://raw.githubusercontent.com/dwyl/english-words/master/words_dictionary.json'),
  IMPORT_BATCH_SIZE: z.coerce.number().int().positive().max(20_000).default(5_000),
});

export interface ImporterEnvironment {
  databaseUrl: string;
  sourceUrl: string;
  batchSize: number;
}

export function parseImporterEnvironment(input: NodeJS.ProcessEnv): ImporterEnvironment {
  const value = environmentSchema.parse(input);

  return {
    databaseUrl: value.DATABASE_URL,
    sourceUrl: value.WORDS_SOURCE_URL,
    batchSize: value.IMPORT_BATCH_SIZE,
  };
}
