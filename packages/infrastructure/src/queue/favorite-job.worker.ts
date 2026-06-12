import type { PersistFavorite, PersistUnfavorite } from '@english-dictionary/application';
import { FavoriteJobs } from '@english-dictionary/contracts';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';

export interface FavoriteWorkerLogger {
  log(event: Record<string, unknown>): void;
  error(event: Record<string, unknown>): void;
}

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
    logger: FavoriteWorkerLogger,
    concurrency: number,
  ) {
    this.worker = new Worker<FavoriteJobs.Payload, void, FavoriteJobs.Name>(
      FavoriteJobs.queueName,
      async (job) => processor.process(job.name, job.data),
      {
        connection,
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      logger.log({
        event: 'favorite_job_completed',
        jobId: job.id,
        jobName: job.name,
      });
    });
    this.worker.on('failed', (job, error) => {
      logger.error({
        event: 'favorite_job_failed',
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
      });
    });
  }

  close(): Promise<void> {
    return this.worker.close();
  }
}
