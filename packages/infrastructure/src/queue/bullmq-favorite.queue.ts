import type { FavoriteQueue } from '@english-dictionary/application';
import { FavoriteJobs } from '@english-dictionary/contracts';
import { Queue, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';

export class BullMqFavoriteQueue implements FavoriteQueue {
  private readonly queue: Queue<FavoriteJobs.Payload, void, FavoriteJobs.Name>;
  private readonly events: QueueEvents;

  constructor(
    connection: Redis,
    private readonly timeoutMs: number,
  ) {
    this.queue = new Queue(FavoriteJobs.queueName, { connection });
    this.events = new QueueEvents(FavoriteJobs.queueName, { connection });
  }

  async dispatch(name: FavoriteJobs.Name, payload: FavoriteJobs.Payload): Promise<void> {
    const job = await this.queue.add(name, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    await job.waitUntilFinished(this.events, this.timeoutMs);
  }

  async close(): Promise<void> {
    await Promise.all([this.events.close(), this.queue.close()]);
  }
}
