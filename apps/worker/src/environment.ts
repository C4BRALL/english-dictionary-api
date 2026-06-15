import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    FAVORITE_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    BETTER_STACK_SOURCE_TOKEN: optionalString,
    BETTER_STACK_INGESTING_URL: optionalUrl,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.BETTER_STACK_SOURCE_TOKEN) !== Boolean(value.BETTER_STACK_INGESTING_URL)) {
      context.addIssue({
        code: 'custom',
        message: 'Better Stack source token and ingesting URL must be configured together',
      });
    }
  });

export interface WorkerEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    betterStack?: {
      sourceToken: string;
      ingestingUrl: string;
    };
  };
}

export function parseWorkerEnvironment(input: NodeJS.ProcessEnv): WorkerEnvironment {
  const value = environmentSchema.parse(input);

  return {
    nodeEnv: value.NODE_ENV,
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    concurrency: value.FAVORITE_WORKER_CONCURRENCY,
    logging: {
      level: value.LOG_LEVEL ?? (value.NODE_ENV === 'development' ? 'debug' : 'info'),
      ...(value.BETTER_STACK_SOURCE_TOKEN && value.BETTER_STACK_INGESTING_URL
        ? {
            betterStack: {
              sourceToken: value.BETTER_STACK_SOURCE_TOKEN,
              ingestingUrl: value.BETTER_STACK_INGESTING_URL,
            },
          }
        : {}),
    },
  };
}
