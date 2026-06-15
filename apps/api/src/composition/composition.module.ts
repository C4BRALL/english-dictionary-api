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
} from '@english-dictionary/infrastructure';

import type { Environment } from '../common/config/environment.js';
import { parseEnvironment } from '../common/config/environment.js';
import { TOKENS } from '../common/di/tokens.js';

class InfrastructureLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.database) private readonly database: DatabaseClient,
    @Inject(TOKENS.redis) private readonly redis: ReturnType<typeof createRedisConnection>,
    @Inject(TOKENS.favoriteQueue) private readonly favoriteQueue: BullMqFavoriteQueue,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.favoriteQueue.close(), this.redis.quit(), this.database.$disconnect()]);
  }
}

@Module({
  providers: [
    {
      provide: TOKENS.environment,
      useFactory: () => parseEnvironment(process.env),
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
      inject: [TOKENS.environment],
      useFactory: (environment: Environment) =>
        new DictionaryApiGateway(environment.dictionaryApiUrl),
    },
    {
      provide: TOKENS.cache,
      inject: [TOKENS.redis],
      useFactory: (redis: ReturnType<typeof createRedisConnection>) => new RedisCacheStore(redis),
    },
    {
      provide: TOKENS.favoriteQueue,
      inject: [TOKENS.redis, TOKENS.environment],
      useFactory: (redis: ReturnType<typeof createRedisConnection>, environment: Environment) =>
        new BullMqFavoriteQueue(redis, environment.favoriteJobTimeoutMs),
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
