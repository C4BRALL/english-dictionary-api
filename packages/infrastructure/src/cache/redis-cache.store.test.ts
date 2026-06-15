import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import type { StructuredLogger } from '../observability/structured-logger.js';
import { RedisCacheStore } from './redis-cache.store.js';

class RedisFake {
  readonly values = new Map<string, string>();
  lastTtl: number | null = null;

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: string, mode: string, ttl: number): Promise<'OK'> {
    expect(mode).toBe('EX');
    this.values.set(key, value);
    this.lastTtl = ttl;
    return Promise.resolve('OK');
  }
}

describe('RedisCacheStore', () => {
  it('serializes values with an expiration and restores them', async () => {
    const redis = new RedisFake();
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
    } as unknown as StructuredLogger;
    const cache = new RedisCacheStore(redis as unknown as Redis, logger);

    await cache.set('key', { value: 1 }, 60);

    await expect(cache.get<{ value: number }>('key')).resolves.toEqual({ value: 1 });
    expect(redis.lastTtl).toBe(60);
    await expect(cache.get('missing')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      'cache_hit',
      expect.objectContaining({ response: { found: true } }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'cache_miss',
      expect.objectContaining({ response: { found: false } }),
    );
  });

  it('logs and rethrows Redis read and write failures', async () => {
    const failure = new Error('redis unavailable');
    const redis = {
      get: vi.fn(() => Promise.reject(failure)),
      set: vi.fn(() => Promise.reject(failure)),
    };
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
    } as unknown as StructuredLogger;
    const cache = new RedisCacheStore(redis as unknown as Redis, logger);

    await expect(cache.get('key')).rejects.toBe(failure);
    await expect(cache.set('key', { value: 1 }, 60)).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
