import { Redis } from 'ioredis';

export function createRedisConnection(url: string): Redis {
  return new Redis(url, {
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
  });
}
