import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import {
  AddFavorite,
  GetUserProfile,
  GetWordDetails,
  ListFavorites,
  ListHistory,
  ListWords,
  PersistFavorite,
  PersistUnfavorite,
  RemoveFavorite,
  SignIn,
  SignUp,
  type CacheStore,
  type DictionaryGateway,
  type FavoriteQueue,
  type FavoriteRepository,
  type HistoryRepository,
  type PasswordHasher,
  type TokenIssuer,
  type UserRepository,
  type WordRepository,
} from '@english-dictionary/application';
import {
  Argon2PasswordHasher,
  BullMqFavoriteQueue,
  createStructuredLogger,
  createPrismaClient,
  createRedisConnection,
  DictionaryApiGateway,
  JwtTokenService,
  PrismaFavoriteRepository,
  PrismaHistoryRepository,
  PrismaUserRepository,
  PrismaWordRepository,
  RedisCacheStore,
  type DatabaseClient,
  type StructuredLogger,
} from '@english-dictionary/infrastructure';

import type { Environment } from '../common/config/environment.js';
import { parseEnvironment } from '../common/config/environment.js';
import { TOKENS } from '../common/di/tokens.js';

class InfrastructureLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.database) private readonly database: DatabaseClient,
    @Inject(TOKENS.redis) private readonly redis: ReturnType<typeof createRedisConnection>,
    @Inject(TOKENS.favoriteQueue) private readonly favoriteQueue: BullMqFavoriteQueue,
    @Inject(TOKENS.logger) private readonly logger: StructuredLogger,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.favoriteQueue.close(), this.redis.quit(), this.database.$disconnect()]);
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
      useFactory: () => parseEnvironment(process.env),
    },
    {
      provide: TOKENS.logger,
      inject: [TOKENS.environment],
      useFactory: (environment: Environment) =>
        createStructuredLogger({
          service: 'api',
          environment: environment.nodeEnv,
          ...environment.logging,
        }),
    },
    {
      provide: TOKENS.database,
      inject: [TOKENS.environment],
      useFactory: (environment: Environment) => createPrismaClient(environment.databaseUrl),
    },
    {
      provide: TOKENS.redis,
      inject: [TOKENS.environment],
      useFactory: (environment: Environment) => createRedisConnection(environment.redisUrl),
    },
    {
      provide: TOKENS.users,
      inject: [TOKENS.database],
      useFactory: (database: DatabaseClient) => new PrismaUserRepository(database),
    },
    {
      provide: TOKENS.words,
      inject: [TOKENS.database],
      useFactory: (database: DatabaseClient) => new PrismaWordRepository(database),
    },
    {
      provide: TOKENS.history,
      inject: [TOKENS.database],
      useFactory: (database: DatabaseClient) => new PrismaHistoryRepository(database),
    },
    {
      provide: TOKENS.favorites,
      inject: [TOKENS.database],
      useFactory: (database: DatabaseClient) => new PrismaFavoriteRepository(database),
    },
    {
      provide: TOKENS.passwordHasher,
      useFactory: () => new Argon2PasswordHasher(),
    },
    {
      provide: TOKENS.tokens,
      inject: [TOKENS.environment],
      useFactory: (environment: Environment) => new JwtTokenService(environment.jwt),
    },
    {
      provide: TOKENS.dictionary,
      inject: [TOKENS.environment, TOKENS.logger],
      useFactory: (environment: Environment, logger: StructuredLogger) =>
        new DictionaryApiGateway(environment.dictionaryApiUrl, logger),
    },
    {
      provide: TOKENS.cache,
      inject: [TOKENS.redis, TOKENS.logger],
      useFactory: (redis: ReturnType<typeof createRedisConnection>, logger: StructuredLogger) =>
        new RedisCacheStore(redis, logger),
    },
    {
      provide: TOKENS.favoriteQueue,
      inject: [TOKENS.redis, TOKENS.environment, TOKENS.logger],
      useFactory: (
        redis: ReturnType<typeof createRedisConnection>,
        environment: Environment,
        logger: StructuredLogger,
      ) => new BullMqFavoriteQueue(redis, environment.favoriteJobTimeoutMs, logger),
    },
    {
      provide: SignUp,
      inject: [TOKENS.users, TOKENS.passwordHasher, TOKENS.tokens],
      useFactory: (users: UserRepository, passwordHasher: PasswordHasher, tokens: TokenIssuer) =>
        new SignUp(users, passwordHasher, tokens),
    },
    {
      provide: SignIn,
      inject: [TOKENS.users, TOKENS.passwordHasher, TOKENS.tokens],
      useFactory: (users: UserRepository, passwordHasher: PasswordHasher, tokens: TokenIssuer) =>
        new SignIn(users, passwordHasher, tokens),
    },
    {
      provide: ListWords,
      inject: [TOKENS.words, TOKENS.cache, TOKENS.environment],
      useFactory: (words: WordRepository, cache: CacheStore, environment: Environment) =>
        new ListWords(words, cache, environment.cache),
    },
    {
      provide: GetWordDetails,
      inject: [TOKENS.words, TOKENS.dictionary, TOKENS.history, TOKENS.cache, TOKENS.environment],
      useFactory: (
        words: WordRepository,
        dictionary: DictionaryGateway,
        history: HistoryRepository,
        cache: CacheStore,
        environment: Environment,
      ) => new GetWordDetails(words, dictionary, history, cache, environment.cache),
    },
    {
      provide: AddFavorite,
      inject: [TOKENS.words, TOKENS.favoriteQueue],
      useFactory: (words: WordRepository, queue: FavoriteQueue) => new AddFavorite(words, queue),
    },
    {
      provide: RemoveFavorite,
      inject: [TOKENS.words, TOKENS.favoriteQueue],
      useFactory: (words: WordRepository, queue: FavoriteQueue) => new RemoveFavorite(words, queue),
    },
    {
      provide: GetUserProfile,
      inject: [TOKENS.users],
      useFactory: (users: UserRepository) => new GetUserProfile(users),
    },
    {
      provide: ListHistory,
      inject: [TOKENS.history],
      useFactory: (history: HistoryRepository) => new ListHistory(history),
    },
    {
      provide: ListFavorites,
      inject: [TOKENS.favorites],
      useFactory: (favorites: FavoriteRepository) => new ListFavorites(favorites),
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
    InfrastructureLifecycle,
  ],
  exports: [
    TOKENS.tokens,
    TOKENS.logger,
    SignUp,
    SignIn,
    ListWords,
    GetWordDetails,
    AddFavorite,
    RemoveFavorite,
    GetUserProfile,
    ListHistory,
    ListFavorites,
  ],
})
export class CompositionModule {}
