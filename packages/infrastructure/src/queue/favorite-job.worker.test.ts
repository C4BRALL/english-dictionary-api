import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogDetails } from '../observability/structured-logger.js';

interface TestJob {
  id: string;
  name: string;
  data: {
    transactionId: string;
    userId: string;
    word: string;
  };
  attemptsMade: number;
  opts: {
    attempts: number;
    backoff: { type: string; delay: number };
  };
}

const workerState = vi.hoisted(() => ({
  processor: undefined as ((job: TestJob) => Promise<void>) | undefined,
  handlers: new Map<string, (...arguments_: unknown[]) => void>(),
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_queueName: string, processor: (job: TestJob) => Promise<void>) {
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
    await router.process('favorite.add', {
      transactionId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      word: 'fire',
    });

    expect(persistFavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('routes favorite removals', async () => {
    await router.process('favorite.remove', {
      transactionId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      word: 'fire',
    });

    expect(persistUnfavorite.execute).toHaveBeenCalledWith('user-1', 'fire');
  });

  it('rejects unknown jobs', async () => {
    await expect(
      router.process('favorite.unknown', {
        transactionId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        word: 'fire',
      }),
    ).rejects.toThrow('Unsupported favorite job');
  });
});

describe('BullMqFavoriteWorker', () => {
  const processor = {
    process: vi.fn().mockResolvedValue(undefined),
  } as unknown as FavoriteJobRouter;
  const logger = {
    instance: {} as never,
    debug: vi.fn<(event: string, details?: LogDetails) => void>(),
    info: vi.fn<(event: string, details?: LogDetails) => void>(),
    warn: vi.fn<(event: string, details?: LogDetails) => void>(),
    error: vi.fn<(event: string, details?: LogDetails) => void>(),
    flush: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    workerState.handlers.clear();
    workerState.processor = undefined;
  });

  it('processes jobs and reports lifecycle events', async () => {
    const worker = new BullMqFavoriteWorker({} as Redis, processor, logger, 2);
    const payload = {
      transactionId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      word: 'fire',
    };
    const job: TestJob = {
      id: 'job-1',
      name: 'favorite.add',
      data: payload,
      attemptsMade: 0,
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    };

    await workerState.processor?.(job);
    workerState.handlers.get('completed')?.({ ...job, attemptsMade: 1 });
    workerState.handlers.get('failed')?.(
      { ...job, id: 'job-2', name: 'favorite.remove', attemptsMade: 1 },
      new Error('database unavailable'),
    );
    await worker.close();

    expect(processor.process).toHaveBeenCalledWith('favorite.add', payload);
    const started = logger.info.mock.calls.find(([event]) => event === 'favorite_job_started');
    const failed = logger.error.mock.calls.find(([event]) => event === 'favorite_job_failed');
    expect(started?.[1]?.payload).toMatchObject({ data: payload });
    expect(logger.info).toHaveBeenCalledWith(
      'favorite_job_completed',
      expect.objectContaining({ response: { status: 'completed' } }),
    );
    expect(failed?.[1]?.response).toEqual({ status: 'failed' });
    expect(failed?.[1]?.error).toBeInstanceOf(Error);
    expect(logger.warn).toHaveBeenCalledWith(
      'favorite_job_retry_scheduled',
      expect.objectContaining({ response: { status: 'retrying' } }),
    );
    expect(workerState.close).toHaveBeenCalledOnce();
  });
});
