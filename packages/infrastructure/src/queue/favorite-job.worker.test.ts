import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerState = vi.hoisted(() => ({
  processor: undefined as
    | ((job: { name: string; data: { userId: string; word: string } }) => Promise<void>)
    | undefined,
  handlers: new Map<string, (...arguments_: unknown[]) => void>(),
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(
      _queueName: string,
      processor: (job: { name: string; data: { userId: string; word: string } }) => Promise<void>,
    ) {
      workerState.processor = processor;
    }

    on(event: string, handler: (...arguments_: unknown[]) => void): this {
      workerState.handlers.set(event, handler);
      return this;
    }

    close(): Promise<void> {
      return workerState.close();
    }
  },
}));

import { BullMqFavoriteWorker, FavoriteJobRouter } from './favorite-job.worker.js';

describe('FavoriteJobRouter', () => {
  const persistFavorite = { execute: vi.fn() };
  const persistUnfavorite = { execute: vi.fn() };
  const router = new FavoriteJobRouter(persistFavorite, persistUnfavorite);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes favorite additions', async () => {
    await router.process('favorite.add', { userId: 'user-1', word: 'fire' });

    expect(persistFavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('routes favorite removals', async () => {
    await router.process('favorite.remove', { userId: 'user-1', word: 'fire' });

    expect(persistUnfavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('rejects unknown jobs', async () => {
    await expect(
      router.process('favorite.unknown', { userId: 'user-1', word: 'fire' }),
    ).rejects.toThrow('Unsupported favorite job');
  });
});

describe('BullMqFavoriteWorker', () => {
  const processor = {
    process: vi.fn().mockResolvedValue(undefined),
  } as unknown as FavoriteJobRouter;
  const logger = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    workerState.handlers.clear();
    workerState.processor = undefined;
  });

  it('processes jobs and reports lifecycle events', async () => {
    const worker = new BullMqFavoriteWorker({} as Redis, processor, logger, 2);
    const payload = { userId: 'user-1', word: 'fire' };

    await workerState.processor?.({ name: 'favorite.add', data: payload });
    workerState.handlers.get('completed')?.({ id: 'job-1', name: 'favorite.add' });
    workerState.handlers.get('failed')?.(
      { id: 'job-2', name: 'favorite.remove' },
      new Error('database unavailable'),
    );
    await worker.close();

    expect(processor.process).toHaveBeenCalledWith('favorite.add', payload);
    expect(logger.log).toHaveBeenCalledWith({
      event: 'favorite_job_completed',
      jobId: 'job-1',
      jobName: 'favorite.add',
    });
    expect(logger.error).toHaveBeenCalledWith({
      event: 'favorite_job_failed',
      jobId: 'job-2',
      jobName: 'favorite.remove',
      error: 'database unavailable',
    });
    expect(workerState.close).toHaveBeenCalledOnce();
  });
});
