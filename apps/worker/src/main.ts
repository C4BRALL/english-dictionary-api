import 'reflect-metadata';

import { ConsoleLogger, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  PersistFavorite,
  PersistUnfavorite,
  type FavoriteRepository,
} from '@english-dictionary/application';
import {
  BullMqFavoriteWorker,
  createPrismaClient,
  createRedisConnection,
  FavoriteJobRouter,
  PrismaFavoriteRepository,
  type DatabaseClient,
  type FavoriteWorkerLogger,
} from '@english-dictionary/infrastructure';

import { parseWorkerEnvironment, type WorkerEnvironment } from './environment.js';

const TOKENS = {
  environment: Symbol('WORKER_ENVIRONMENT'),
  database: Symbol('DATABASE'),
  redis: Symbol('REDIS'),
  favorites: Symbol('FAVORITE_REPOSITORY'),
  logger: Symbol('WORKER_LOGGER'),
} as const;

class WorkerLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.database) private readonly database: DatabaseClient,
    @Inject(TOKENS.redis) private readonly redis: ReturnType<typeof createRedisConnection>,
    private readonly worker: BullMqFavoriteWorker,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
    await this.redis.quit();
    await this.database.$disconnect();
  }
}

@Module({
  providers: [
    {
      provide: TOKENS.environment,
      useFactory: () => parseWorkerEnvironment(process.env),
    },
    {
      provide: TOKENS.logger,
      useFactory: (): FavoriteWorkerLogger => {
        const logger = new ConsoleLogger('FavoriteWorker', { json: true });
        return {
          log: (event) => logger.log(event),
          error: (event) => logger.error(event),
        };
      },
    },
    {
      provide: TOKENS.database,
      inject: [TOKENS.environment],
      useFactory: (environment: WorkerEnvironment) => createPrismaClient(environment.databaseUrl),
    },
    {
      provide: TOKENS.redis,
      inject: [TOKENS.environment],
      useFactory: (environment: WorkerEnvironment) => createRedisConnection(environment.redisUrl),
    },
    {
      provide: TOKENS.favorites,
      inject: [TOKENS.database],
      useFactory: (database: DatabaseClient) => new PrismaFavoriteRepository(database),
    },
    {
      provide: PersistFavorite,
      inject: [TOKENS.favorites],
      useFactory: (favorites: FavoriteRepository) => new PersistFavorite(favorites),
    },
    {
      provide: PersistUnfavorite,
      inject: [TOKENS.favorites],
      useFactory: (favorites: FavoriteRepository) => new PersistUnfavorite(favorites),
    },
    {
      provide: FavoriteJobRouter,
      inject: [PersistFavorite, PersistUnfavorite],
      useFactory: (persistFavorite: PersistFavorite, persistUnfavorite: PersistUnfavorite) =>
        new FavoriteJobRouter(persistFavorite, persistUnfavorite),
    },
    {
      provide: BullMqFavoriteWorker,
      inject: [TOKENS.redis, FavoriteJobRouter, TOKENS.logger, TOKENS.environment],
      useFactory: (
        redis: ReturnType<typeof createRedisConnection>,
        processor: FavoriteJobRouter,
        logger: FavoriteWorkerLogger,
        environment: WorkerEnvironment,
      ) => new BullMqFavoriteWorker(redis, processor, logger, environment.concurrency),
    },
    WorkerLifecycle,
  ],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.enableShutdownHooks();
}

void bootstrap();
