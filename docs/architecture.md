# Architecture

The solution is a pnpm and Turborepo monorepo with three independently
executable applications. It applies Clean Architecture with lightweight tactical
DDD: domain types express invariants, application use cases coordinate behavior,
and infrastructure implements external capabilities.

## Dependency Diagram

```mermaid
flowchart TD
  API["apps/api<br/>HTTP composition root"]
  Worker["apps/worker<br/>Queue composition root"]
  Importer["apps/importer<br/>Import composition root"]
  Infrastructure["packages/infrastructure<br/>Adapters"]
  Application["packages/application<br/>Use cases and ports"]
  Domain["packages/domain<br/>Entities and value objects"]
  Contracts["packages/contracts<br/>BullMQ job contracts"]
  PostgreSQL[("PostgreSQL 18")]
  Redis[("Redis 8")]
  Dictionary["Free Dictionary API"]
  WordSource["GitHub word source"]

  API --> Infrastructure
  Worker --> Infrastructure
  Importer --> Infrastructure
  Infrastructure --> Application
  Infrastructure --> Contracts
  Application --> Domain
  Application --> Contracts
  Infrastructure --> PostgreSQL
  Infrastructure --> Redis
  Infrastructure --> Dictionary
  Infrastructure --> WordSource
```

Dependencies point inward. Domain and application have no framework imports.

## Request Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as NestJS API
  participant UseCase as Application use case
  participant Cache as Redis
  participant DB as PostgreSQL
  participant External as Dictionary API

  Client->>API: GET /entries/en/fire + Bearer token
  API->>UseCase: GetWordDetails(userId, fire)
  UseCase->>Cache: get definition
  alt cache hit
    Cache-->>UseCase: cached details
  else cache miss
    UseCase->>External: GET /api/v2/entries/en/fire
    External-->>UseCase: validated details
    UseCase->>Cache: set with TTL
  end
  UseCase->>DB: append history entry
  UseCase-->>API: details + cache status
  API-->>Client: 200 + x-cache + x-response-time
```

## Favorite Flow

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant Queue as BullMQ/Redis
  participant Worker
  participant DB as PostgreSQL

  Client->>API: POST /entries/en/fire/favorite
  API->>DB: confirm dictionary word exists
  API->>Queue: add favorite.add job
  Queue->>Worker: deliver job
  Worker->>DB: upsert favorite
  DB-->>Worker: committed
  Worker-->>Queue: completed
  Queue-->>API: waitUntilFinished
  API-->>Client: 204
```

The bounded wait preserves the challenge's synchronous HTTP expectation while
the persistence mechanism remains asynchronous and independently scalable.

## Import Flow

```mermaid
flowchart LR
  Command["Explicit tools profile or pnpm command"]
  Source["words_dictionary.json"]
  Validate["Normalize and validate"]
  Batch["Batches up to 5,000"]
  Insert["createMany + skipDuplicates"]
  Words[("words table")]

  Command --> Source --> Validate --> Batch --> Insert --> Words
```

The unique `words.word` index and `skipDuplicates` make repeated imports
idempotent.

## Dependency Rules

- Domain code has no framework or infrastructure dependencies.
- Application code defines small ports and coordinates domain behavior.
- Infrastructure adapters implement application ports.
- Apps are composition roots and own process lifecycle.
- Controllers validate transport input and delegate to one use case.
- Shared imports use package root exports rather than internal file paths.
- Redis is never the source of truth.
- Queue contracts are the only approved TypeScript namespace.

## Runtime Processes

- `api` serves the REST contract and OpenAPI documentation.
- `worker` consumes favorite jobs with configurable concurrency.
- `importer` is an explicit one-shot operation under the Compose `tools`
  profile.
- `migrate` applies committed Prisma migrations before API and worker startup.
- PostgreSQL stores users, words, history, and favorites.
- Redis stores cache entries and BullMQ state.

## Data Model

- `users.email` is unique; only `password_hash` is persisted.
- `words.word` is unique and has a `text_pattern_ops` prefix index.
- `history` is append-only and indexed by user and descending timestamp.
- `favorites` is unique by user and word for idempotency.
- Foreign keys cascade on user or word deletion.

## Operational Boundaries

- API, worker, and importer use separate processes and shutdown hooks.
- Connection providers are process-scoped singletons managed by NestJS.
- Queue jobs retry three times with exponential backoff.
- Cache TTL values, worker concurrency, endpoints, and credentials are
  environment-driven.
- Logs are structured JSON in production and exclude passwords and tokens.
- Correlation IDs are accepted from trusted callers or generated per request.

## Key Decisions

1. Use page/limit pagination to match the mandatory response contract.
2. Keep detail responses in Redis but always append history on successful views,
   including cache hits.
3. Wait for favorite jobs with a timeout so `204` confirms persistence.
4. Validate upstream JSON with Zod to protect the application boundary.
5. Use Argon2id hashing; use JWT signing, not payload encryption.
6. Avoid explicit Composite and Singleton implementations because the current
   domain and container lifecycle do not require them.
