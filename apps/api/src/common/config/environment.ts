import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('english-dictionary-api'),
  JWT_AUDIENCE: z.string().default('english-dictionary-client'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DICTIONARY_API_URL: z.string().url().default('https://api.dictionaryapi.dev'),
  CACHE_LIST_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  CACHE_DETAIL_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  FAVORITE_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    secret: string;
    issuer: string;
    audience: string;
    expiresIn: string;
  };
  corsOrigins: string[];
  dictionaryApiUrl: string;
  cache: {
    listTtlSeconds: number;
    detailTtlSeconds: number;
  };
  favoriteJobTimeoutMs: number;
}

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  const value = environmentSchema.parse(input);

  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    jwt: {
      secret: value.JWT_SECRET,
      issuer: value.JWT_ISSUER,
      audience: value.JWT_AUDIENCE,
      expiresIn: value.JWT_EXPIRES_IN,
    },
    corsOrigins: value.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    dictionaryApiUrl: value.DICTIONARY_API_URL,
    cache: {
      listTtlSeconds: value.CACHE_LIST_TTL_SECONDS,
      detailTtlSeconds: value.CACHE_DETAIL_TTL_SECONDS,
    },
    favoriteJobTimeoutMs: value.FAVORITE_JOB_TIMEOUT_MS,
  };
}
