import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import type { StructuredLogger } from '../observability/structured-logger.js';
import { runWithTransaction } from '../observability/transaction-context.js';

const queueState = vi.hoisted(() => ({
  add: vi.fn(),
  waitUntilFinished: vi.fn(() => Promise.resolve()),
  closeQueue: vi.fn(() => Promise.resolve()),
  closeEvents: vi.fn(() => Promise.resolve()),
}));

vi.mock('bullmq', () => ({
  Queue: class {
    add = queueState.add;
    close = queueState.closeQueue;
  },
  QueueEvents: class {
    close = queueState.closeEvents;
  },
}));

import { BullMqFavoriteQueue } from './bullmq-favorite.queue.js';

describe('BullMqFavoriteQueue', () => {
  it('propagates transaction context and logs the queued payload', async () => {
    queueState.add.mockResolvedValue({
      id: 'job-1',
      waitUntilFinished: queueState.waitUntilFinished,
    });
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as StructuredLogger;
    const queue = new BullMqFavoriteQueue({} as Redis, 1_000, logger);

    await runWithTransaction({ transactionId: '11111111-1111-4111-8111-111111111111' }, () =>
      queue.dispatch('favorite.add', { userId: 'user-1', word: 'fire' }),
    );

    expect(queueState.add).toHaveBeenCalledWith(
      'favorite.add',
      {
        transactionId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-1',
        word: 'fire',
      },
      expect.objectContaining({ attempts: 3 }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'favorite_job_enqueued',
      expect.objectContaining({
        response: { status: 'queued' },
      }),
    );
  });

  it('logs and rethrows queue failures', async () => {
    const failure = new Error('queue unavailable');
    queueState.add.mockRejectedValueOnce(failure);
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as StructuredLogger;
    const queue = new BullMqFavoriteQueue({} as Redis, 1_000, logger);

    await expect(
      queue.dispatch('favorite.remove', { userId: 'user-1', word: 'fire' }),
    ).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      'favorite_job_enqueue_failed',
      expect.objectContaining({ error: failure }),
    );
  });
});
