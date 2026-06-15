import type { PersistFavorite, PersistUnfavorite } from '@english-dictionary/application';
import { FavoriteJobs } from '@english-dictionary/contracts';
import { randomUUID } from 'node:crypto';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';

import type { StructuredLogger } from '../observability/structured-logger.js';
import { runWithTransaction } from '../observability/transaction-context.js';

type FavoritePersistence = Pick<PersistFavorite, 'execute'>;
type UnfavoritePersistence = Pick<PersistUnfavorite, 'execute'>;

export class FavoriteJobRouter {
  constructor(
    private readonly persistFavorite: FavoritePersistence,
    private readonly persistUnfavorite: UnfavoritePersistence,
  ) {}

  async process(name: string, payload: FavoriteJobs.Payload): Promise<void> {
    if (name === FavoriteJobs.names.add) {
      await this.persistFavorite.execute(payload.userId, payload.word);
      return;
    }

    if (name === FavoriteJobs.names.remove) {
      await this.persistUnfavorite.execute(payload.userId, payload.word);
      return;
    }

    throw new Error(`Unsupported favorite job: ${name}`);
  }
}

export class BullMqFavoriteWorker {
  private readonly worker: Worker<FavoriteJobs.Payload, void, FavoriteJobs.Name>;

  constructor(
    connection: Redis,
    processor: FavoriteJobRouter,
    logger: StructuredLogger,
    concurrency: number,
  ) {
    this.worker = new Worker<FavoriteJobs.Payload, void, FavoriteJobs.Name>(
      FavoriteJobs.queueName,
      async (job) =>
        runWithTransaction(
          {
            transactionId: job.data.transactionId,
            userId: job.data.userId,
          },
          async () => {
            logger.info('favorite_job_started', {
              payload: {
                jobId: job.id,
                jobName: job.name,
                attempt: job.attemptsMade + 1,
                data: job.data,
              },
              response: { status: 'processing' },
            });
            await processor.process(job.name, job.data);
          },
        ),
      {
        connection,
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      runWithTransaction({ transactionId: job.data.transactionId, userId: job.data.userId }, () => {
        logger.info('favorite_job_completed', {
          payload: {
            jobId: job.id,
            jobName: job.name,
            attempt: job.attemptsMade,
            data: job.data,
          },
          response: { status: 'completed' },
        });
      });
    });
    this.worker.on('failed', (job, error) => {
      const attempts = job?.opts.attempts ?? 1;
      const attemptsMade = job?.attemptsMade ?? attempts;
      const context = job
        ? { transactionId: job.data.transactionId, userId: job.data.userId }
        : { transactionId: randomUUID() };

      runWithTransaction(context, () => {
        logger.error('favorite_job_failed', {
          payload: {
            jobId: job?.id,
            jobName: job?.name,
            attempt: attemptsMade,
            attempts,
            data: job?.data,
          },
          response: { status: 'failed' },
          error,
        });

        if (job && attemptsMade < attempts) {
          logger.warn('favorite_job_retry_scheduled', {
            payload: {
              jobId: job.id,
              jobName: job.name,
              attempt: attemptsMade + 1,
              attempts,
              backoff: job.opts.backoff,
            },
            response: { status: 'retrying' },
          });
        }
      });
    });
  }

  close(): Promise<void> {
    return this.worker.close();
  }
}
