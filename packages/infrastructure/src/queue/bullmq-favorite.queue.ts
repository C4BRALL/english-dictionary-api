import type { FavoriteCommandPayload, FavoriteQueue } from '@english-dictionary/application';
import { FavoriteJobs } from '@english-dictionary/contracts';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';

import { getTransactionContext } from '../observability/transaction-context.js';
import type { StructuredLogger } from '../observability/structured-logger.js';

export class BullMqFavoriteQueue implements FavoriteQueue {
  private readonly queue: Queue<FavoriteJobs.Payload, void, FavoriteJobs.Name>;
  private readonly events: QueueEvents;

  constructor(
    connection: Redis,
    private readonly timeoutMs: number,
    private readonly logger: StructuredLogger,
  ) {
    this.queue = new Queue(FavoriteJobs.queueName, { connection });
    this.events = new QueueEvents(FavoriteJobs.queueName, { connection });
  }

  async dispatch(name: FavoriteJobs.Name, payload: FavoriteCommandPayload): Promise<void> {
    const jobPayload: FavoriteJobs.Payload = {
      transactionId: getTransactionContext()?.transactionId ?? randomUUID(),
      ...payload,
    };
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    } as const;
    const startedAt = performance.now();

    try {
      const job = await this.queue.add(name, jobPayload, jobOptions);
      this.logger.info('favorite_job_enqueued', {
        durationMs: performance.now() - startedAt,
        payload: {
          jobId: job.id,
          jobName: name,
          data: jobPayload,
          attempts: jobOptions.attempts,
          backoff: jobOptions.backoff,
        },
        response: { status: 'queued' },
      });
      await job.waitUntilFinished(this.events, this.timeoutMs);
    } catch (error) {
      this.logger.error('favorite_job_enqueue_failed', {
        durationMs: performance.now() - startedAt,
        payload: { jobName: name, data: jobPayload },
        response: { status: 'failed' },
        error,
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    await Promise.all([this.events.close(), this.queue.close()]);
  }
}
