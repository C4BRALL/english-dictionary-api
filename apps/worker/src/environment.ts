import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  FAVORITE_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

export interface WorkerEnvironment {
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
}

export function parseWorkerEnvironment(input: NodeJS.ProcessEnv): WorkerEnvironment {
  const value = environmentSchema.parse(input);

  return {
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    concurrency: value.FAVORITE_WORKER_CONCURRENCY,
  };
}
