export {
  ApplicationError,
  ConflictError,
  InvalidCredentialsError,
  ResourceNotFoundError,
  ValidationError,
} from './errors/application.error.js';
export {
  type CachedResult,
  type CacheStatus,
  type DictionaryDefinition,
  type DictionaryEntry,
  type DictionaryLicense,
  type DictionaryMeaning,
  type DictionaryPhonetic,
} from './models/dictionary-entry.js';
export { createPageResult, type PageRequest, type PageResult } from './models/pagination.js';
export { type FavoriteRepository, type HistoryRepository } from './ports/activity.repositories.js';
export type { CacheStore } from './ports/cache.store.js';
export type { DictionaryGateway } from './ports/dictionary.gateway.js';
export type { FavoriteQueue } from './ports/favorite.queue.js';
export type { PasswordHasher, TokenIssuer, TokenVerifier } from './ports/security.js';
export type { CreateUserInput, UserRepository } from './ports/user.repository.js';
export type { WordPage, WordRepository, WordSource } from './ports/word.repository.js';
export { CacheKeys } from './services/cache-keys.js';
export { validateName, validatePage, validatePassword } from './services/validation.js';
export {
  SignIn,
  SignUp,
  type AuthenticationResult,
  type SignInCommand,
  type SignUpCommand,
} from './use-cases/auth.js';
export { GetWordDetails, ListWords, type DictionaryCacheSettings } from './use-cases/dictionary.js';
export {
  AddFavorite,
  PersistFavorite,
  PersistUnfavorite,
  RemoveFavorite,
} from './use-cases/favorites.js';
export { ImportWords, type ImportWordsResult } from './use-cases/import-words.js';
export { GetUserProfile, ListFavorites, ListHistory } from './use-cases/users.js';
