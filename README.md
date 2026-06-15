# English Dictionary API

Backend solution for the Flora Energia software engineering challenge. The API
authenticates users, lists English words, proxies word details from the Free
Dictionary API, records history, and persists favorites asynchronously.

Public repository:
[C4BRALL/english-dictionary-api](https://github.com/C4BRALL/english-dictionary-api)

## Highlights

- NestJS REST API with JWT Bearer authentication and Argon2id password hashing.
- PostgreSQL source of truth with idempotent import of 370,100 English words.
- Native PostgreSQL UUIDs for every primary and foreign key.
- Audited soft deletion for users, words, and favorites.
- Redis cache with configurable TTL and `x-cache: HIT|MISS`.
- BullMQ worker for idempotent favorite and unfavorite persistence.
- OpenAPI 3 documentation at `/docs` and `/docs-json`.
- Structured logs, correlation IDs, response timing, Helmet, CORS allowlist,
  throttling, and global validation.
- Unit, adapter, and HTTP tests with enforced coverage thresholds.
- Docker Compose runtime and GitHub Actions CI.

## Technology

| Area            | Technology                                  |
| --------------- | ------------------------------------------- |
| Runtime         | Node.js 24, TypeScript 5.9                  |
| API             | NestJS 11, Swagger/OpenAPI 3                |
| Database        | PostgreSQL 18, Prisma 7                     |
| Cache and queue | Redis 8, BullMQ 5                           |
| Security        | Argon2id, JWT/JWS, Helmet, CORS, throttling |
| Tests           | Vitest 4, Supertest, V8 coverage            |
| Tooling         | pnpm 11, Turborepo 2, ESLint 9, Prettier 3  |
| Delivery        | Docker Compose, GitHub Actions              |

## Architecture

The monorepo follows Clean Architecture dependency direction:

```text
apps -> infrastructure -> application -> domain
                         -> contracts
```

```text
apps/
  api/               NestJS HTTP composition root
  worker/            BullMQ consumer composition root
  importer/          Explicit one-shot dictionary import
packages/
  domain/            Entities, value objects, domain errors
  application/       Use cases, ports, pagination, cache keys
  infrastructure/    Prisma, Redis, BullMQ, security and HTTP adapters
  contracts/         Shared queue contracts
  eslint-config/     Shared lint rules
  typescript-config/ Shared TypeScript rules
docs/
  architecture.md    Dependency and runtime diagrams
```

Controllers contain transport concerns only. Use cases do not import NestJS,
Prisma, Redis, or BullMQ. Concrete adapters are selected in the application
composition roots.

See [docs/architecture.md](docs/architecture.md) for dependency and sequence
diagrams.

## Quick Start With Docker

Requirements: Docker Desktop with Docker Compose.

```bash
docker compose up -d --build
docker compose --profile tools run --rm importer
```

The importer is under the `tools` profile and never runs during normal startup.
It is safe to run repeatedly because PostgreSQL ignores duplicate words.

After startup:

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>
- OpenAPI JSON: <http://localhost:3000/docs-json>

Stop the runtime:

```bash
docker compose down
```

Remove local database and cache volumes:

```bash
docker compose down --volumes
```

The initial migration is intentionally rewritten during this evaluation. Remove
existing volumes before applying it when upgrading from the earlier `BIGINT`
schema.

## Local Development

Requirements: Node.js 24, pnpm 11, PostgreSQL 18, and Redis 8.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:deploy
pnpm import:words
pnpm dev
```

The API uses port `3000` by default. The worker and API are persistent
Turborepo tasks; the importer exits after the import.

Important environment variables:

| Variable                      | Purpose                                   | Default/example                 |
| ----------------------------- | ----------------------------------------- | ------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection                     | `postgresql://...`              |
| `REDIS_URL`                   | Redis connection                          | `redis://localhost:6379`        |
| `JWT_SECRET`                  | JWT signing secret, minimum 32 characters | required                        |
| `CORS_ORIGINS`                | Comma-separated origin allowlist          | `http://localhost:3000`         |
| `DICTIONARY_API_URL`          | Details proxy upstream                    | `https://api.dictionaryapi.dev` |
| `CACHE_LIST_TTL_SECONDS`      | Word-list cache TTL                       | `300`                           |
| `CACHE_DETAIL_TTL_SECONDS`    | Definition cache TTL                      | `86400`                         |
| `WORDS_SOURCE_URL`            | Dictionary JSON source                    | GitHub raw URL                  |
| `IMPORT_BATCH_SIZE`           | Import batch size                         | `5000`                          |
| `FAVORITE_WORKER_CONCURRENCY` | BullMQ concurrency                        | `5`                             |

## API Contract

All routes except `/`, `/auth/signup`, `/auth/signin`, `/docs`, and
`/docs-json` require `Authorization: Bearer <token>`.

| Method | Route                          | Description                      |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/`                            | Service identity                 |
| POST   | `/auth/signup`                 | Register and authenticate        |
| POST   | `/auth/signin`                 | Authenticate                     |
| GET    | `/entries/en`                  | Paginated prefix search          |
| GET    | `/entries/en/:word`            | Proxy details and record history |
| POST   | `/entries/en/:word/favorite`   | Queue idempotent favorite        |
| DELETE | `/entries/en/:word/unfavorite` | Queue idempotent removal         |
| GET    | `/user/me`                     | Authenticated profile            |
| GET    | `/user/me/history`             | Paginated history                |
| GET    | `/user/me/favorites`           | Paginated favorites              |

### Authentication Example

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "content-type: application/json" \
  -d '{"name":"User 1","email":"user@example.com","password":"password123"}'
```

The response contains a token in the challenge format:

```json
{
  "id": "user-id",
  "name": "User 1",
  "token": "Bearer JWT.Token"
}
```

### Search Example

```bash
curl "http://localhost:3000/entries/en?search=fire&page=1&limit=4" \
  -H "authorization: Bearer JWT.Token"
```

```json
{
  "results": ["fire", "fireable", "firearm", "firearmed"],
  "totalDocs": 84,
  "page": 1,
  "totalPages": 21,
  "hasNext": true,
  "hasPrev": false
}
```

Repeated list and detail requests expose:

```text
x-cache: HIT
x-response-time: 5.25ms
x-correlation-id: request UUID
```

## Import and Asynchronous Favorites

The importer downloads `words_dictionary.json`, validates and normalizes each
word, deduplicates each batch, restores matching soft-deleted words, and uses
`createMany(skipDuplicates: true)` for new records. A validated run processed
370,100 words; a second run inserted zero rows.

Favorite commands are sent to the `favorites` BullMQ queue. The API waits for
the bounded job result so a successful `204` means the worker persisted the
change. Jobs use retries with exponential backoff. PostgreSQL uniqueness on
`(user_id, word_id)` makes favorite operations idempotent. Unfavorite sets
`deleted_at`; a later favorite restores the same row and exposes its latest
activation through the existing public `added` field.

## Persistence and Audit Policy

- Every primary and foreign key uses PostgreSQL `UUID`; Prisma represents these
  values as `String @db.Uuid`.
- `users`, `words`, and `favorites` carry `created_at`, `updated_at`, and
  nullable `deleted_at` audit columns.
- Normal queries only return records where `deleted_at IS NULL`.
- Signup restores a deleted user with the same email and replaces name and
  password hash.
- Import restores a deleted word with the same unique value.
- Favorite restores a deleted `(user_id, word_id)` row; unfavorite never
  physically deletes it.
- `history` remains immutable and append-only. Its entries remain readable even
  when the referenced word is soft-deleted.
- Foreign keys use `RESTRICT` for physical deletion so audit records cannot be
  removed accidentally.

## Security

- Passwords are hashed with Argon2id and are never logged or returned.
- JWTs are signed and verified with issuer, audience, expiration, and a
  configurable secret. JWT payloads are encoded, not encrypted.
- Reversible application encryption was intentionally not added because the
  domain stores no secret that must later be decrypted. Transport encryption is
  expected from TLS at the deployment edge.
- Helmet configures security headers.
- CORS uses an explicit allowlist.
- Authentication routes and the global API have rate limits.
- DTO validation rejects unknown fields.
- Error responses hide stack traces and infrastructure details.
- Correlation IDs connect requests to structured error logs.

## Tests and Quality

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Coverage gates:

| Scope              | Lines/statements/functions | Branches |
| ------------------ | -------------------------- | -------- |
| Global minimum     | 80%                        | 75%      |
| Domain target      | 90%                        | 90%      |
| Application target | 90%                        | 90%      |

Validated local results include 100% domain lines, 98% application lines, 99%
API lines, and 98% infrastructure lines. Tests use mocks, stubs, spies, fakes,
and a builder fixture according to the responsibility under test.

GitHub Actions executes migration, formatting, lint, typecheck, coverage, and
build against PostgreSQL 18 and Redis 8.

## Design Patterns

Patterns are used only where they solve a concrete boundary or construction
problem.

| Pattern              | Location                              | Reason                                                                        |
| -------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Adapter              | `packages/infrastructure`             | Implements application ports for Prisma, Redis, BullMQ, Argon2, JWT, and HTTP |
| Proxy                | `DictionaryApiGateway`                | Hides the external dictionary service behind the local API                    |
| Dependency Injection | NestJS modules                        | Replaces infrastructure without changing use cases                            |
| Abstract Server      | Application port interfaces           | Business rules depend on capabilities, not implementations                    |
| Composition Root     | Each app entrypoint                   | Selects concrete adapters and owns lifecycle                                  |
| Factory              | Prisma/Redis creators and `CacheKeys` | Centralizes configurable construction                                         |
| Decorator            | NestJS decorators and `@CurrentUser`  | Adds transport metadata and request context                                   |
| Builder              | `UserBuilder` in authentication tests | Creates focused fixtures with semantic variations                             |
| Singleton            | NestJS provider scope                 | One managed connection instance per process                                   |

`Composite` and an explicit custom `Singleton` were not added because there is
no tree structure or unmanaged global object lifecycle. The DI container already
owns connection instances. Additional wrappers were rejected under KISS and
YAGNI.

## Engineering Decisions

- Page/limit pagination follows the mandatory challenge contract. Cursor
  pagination was left as a documented future improvement.
- PostgreSQL is the source of truth; Redis stores only derived cache and queue
  state.
- History is append-only because every successful detail view is meaningful.
- Mutable records use auditable soft deletion and restoration by unique key.
- Favorites use a unique database constraint and upsert/update-many semantics.
- External HTTP responses are validated with Zod before entering the
  application.
- Small Conventional Commits preserve the implementation sequence in Git
  history.

## Main Scripts

| Command                                            | Description                       |
| -------------------------------------------------- | --------------------------------- |
| `pnpm dev`                                         | Run API and worker in watch mode  |
| `pnpm build`                                       | Build all packages and apps       |
| `pnpm db:deploy`                                   | Apply committed Prisma migrations |
| `pnpm import:words`                                | Run the importer locally          |
| `pnpm test:coverage`                               | Run tests and enforce thresholds  |
| `docker compose up -d --build`                     | Start the complete runtime        |
| `docker compose --profile tools run --rm importer` | Explicit Docker import            |

## License

This repository was created exclusively for the Flora Energia technical
evaluation.
