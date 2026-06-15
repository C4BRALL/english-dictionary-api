import 'reflect-metadata';

import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  PersistFavorite,
  PersistUnfavorite,
  type FavoriteRepository,
} from '@english-dictionary/application';
import {
  BullMqFavoriteWorker,
  createStructuredLogger,
  createPrismaClient,
  createRedisConnection,
  FavoriteJobRouter,
  PrismaFavoriteRepository,
  type DatabaseClient,
  type StructuredLogger,
} from '@english-dictionary/infrastructure';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER, WinstonLogger } from 'nest-winston';

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
    @Inject(TOKENS.logger) private readonly logger: StructuredLogger,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
    await this.redis.quit();
    await this.database.$disconnect();
    this.logger.info('application_stopped', {
      response: { status: 'stopped' },
    });
    await this.logger.flush();
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
      inject: [TOKENS.environment],
      useFactory: (environment: WorkerEnvironment) =>
        createStructuredLogger({
          service: 'worker',
          environment: environment.nodeEnv,
          ...environment.logging,
        }),
    },
  ],
  exports: [TOKENS.environment, TOKENS.logger],
})
class WorkerObservabilityModule {}

@Module({
  imports: [WorkerObservabilityModule],
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      inject: [TOKENS.logger],
      useFactory: (logger: StructuredLogger) => logger.instance,
    },
    {
      provide: WINSTON_MODULE_NEST_PROVIDER,
      inject: [TOKENS.logger],
      useFactory: (logger: StructuredLogger) => new WinstonLogger(logger.instance),
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
        logger: StructuredLogger,
        environment: WorkerEnvironment,
      ) => new BullMqFavoriteWorker(redis, processor, logger, environment.concurrency),
    },
    WorkerLifecycle,
  ],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.enableShutdownHooks();
  app.get<StructuredLogger>(TOKENS.logger).info('application_started', {
    payload: { concurrency: app.get<WorkerEnvironment>(TOKENS.environment).concurrency },
    response: { status: 'ready' },
  });
}

void bootstrap();
