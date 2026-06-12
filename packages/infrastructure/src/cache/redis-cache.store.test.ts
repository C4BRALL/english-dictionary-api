import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

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
    const cache = new RedisCacheStore(redis as unknown as Redis);

    await cache.set('key', { value: 1 }, 60);

    await expect(cache.get<{ value: number }>('key')).resolves.toEqual({ value: 1 });
    expect(redis.lastTtl).toBe(60);
    await expect(cache.get('missing')).resolves.toBeNull();
  });
});
