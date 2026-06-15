import type { CacheStore } from '@english-dictionary/application';
import type { Redis } from 'ioredis';

import type { StructuredLogger } from '../observability/structured-logger.js';

export class RedisCacheStore implements CacheStore {
  constructor(
    private readonly redis: Redis,
    private readonly logger: StructuredLogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const startedAt = performance.now();
    this.logger.debug('cache_read', { payload: { key } });

    try {
      const value = await this.redis.get(key);
      this.logger.debug(value ? 'cache_hit' : 'cache_miss', {
        durationMs: performance.now() - startedAt,
        payload: { key },
        response: { found: Boolean(value) },
      });
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.error('cache_failed', {
        durationMs: performance.now() - startedAt,
        payload: { operation: 'get', key },
        response: { status: 'failed' },
        error,
      });
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const startedAt = performance.now();

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      this.logger.debug('cache_write', {
        durationMs: performance.now() - startedAt,
        payload: { key, ttlSeconds },
        response: { status: 'stored' },
      });
    } catch (error) {
      this.logger.error('cache_failed', {
        durationMs: performance.now() - startedAt,
        payload: { operation: 'set', key, ttlSeconds },
        response: { status: 'failed' },
        error,
      });
      throw error;
    }
  }
}
