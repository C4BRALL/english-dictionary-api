# Engineering Guidelines

This document is authoritative for every contributor and automated agent working
in this repository.

## Delivery Priorities

1. Preserve the public HTTP contracts defined by the Flora Energia challenge.
2. Keep required behavior complete, observable, tested, and documented.
3. Prefer the simplest design that maintains the dependency rules below.
4. Do not add abstractions, services, packages, or patterns without a concrete
   requirement.

## Architectural Rules

- Use Clean Architecture with dependencies pointing inward:
  `apps -> infrastructure -> application -> domain`.
- The domain package must not depend on frameworks, databases, queues, HTTP, or
  environment variables.
- The application package may depend on domain types and abstract ports only.
- Infrastructure implements application ports and owns Prisma, Redis, BullMQ,
  hashing, JWT, and external HTTP clients.
- Apps are composition roots. They wire concrete adapters to use cases.
- Controllers translate HTTP input/output only. Business rules belong in use
  cases or domain objects.
- Keep modules cohesive and organized by business responsibility.
- Avoid circular dependencies and cross-package deep imports. Import only from
  package public entrypoints.

## Engineering Principles

- Apply SRP, OCP, LSP, ISP, DIP, Separation of Concerns, and DRY.
- Apply YAGNI and KISS before introducing a new abstraction.
- Prefer composition over inheritance.
- Keep functions, classes, interfaces, and commits focused on one purpose.
- Use explicit names. Avoid generic names such as `Manager`, `Helper`, or
  `Common` when a business-specific name is available.
- Do not use `any`. Use `unknown` at untrusted boundaries and narrow it.
- Prefer semantic type aliases for identifiers and unions.
- Use utility types when deriving an existing contract.
- Use namespaces only to group BullMQ job contracts.

## Design Patterns

Patterns are tools, not completion criteria. Every use must remove real
complexity or protect a dependency boundary.

- Adapter: Prisma, Redis, BullMQ, password hashing, JWT, and Dictionary API.
- Proxy: the dictionary detail endpoint proxies the external Dictionary API.
- Dependency Injection: inject application ports through NestJS providers.
- Abstract Server: application ports define behavior required from adapters.
- Composition Root: each app root module selects and wires implementations.
- Factory: create configured external clients or normalized cache keys.
- Decorator: use NestJS decorators and focused custom decorators such as
  `@CurrentUser`.
- Builder: create readable test fixtures.
- Singleton: rely on the DI container lifecycle for connection clients.
- Composite: use only if multiple interchangeable validation rules need to be
  evaluated as one policy.

Do not create demonstrative implementations of Factory, Composite, Builder,
Singleton, or inheritance hierarchies solely to claim pattern usage.

## Development Workflow

- Follow TDD for business behavior: red, green, refactor.
- Add or update a test with every behavior change and bug fix.
- Run the narrowest relevant tests while developing, then run the full quality
  gate before delivery.
- Use Conventional Commits.
- Keep commits small and independently understandable.
- Do not mix unrelated formatting, refactoring, features, and fixes.
- Update Mermaid dependency and flow diagrams when architecture changes.

## TypeScript and NestJS

- Enable strict TypeScript settings.
- Keep public package APIs explicit through root `index.ts` files.
- Validate all HTTP and environment input.
- Use DTOs only at transport boundaries; use application commands and results
  internally.
- Map domain and application errors to human-readable HTTP errors centrally.
- Never expose stack traces, database errors, secrets, hashes, or tokens.

## Persistence Rules

- Use native PostgreSQL UUIDs for every primary and foreign key. In Prisma,
  model them as `String @db.Uuid` with `@default(uuid())` on primary keys.
- Mutable persisted entities must expose `createdAt`, `updatedAt`, and nullable
  `deletedAt` audit fields.
- Repository reads for mutable entities must explicitly filter
  `deletedAt: null`.
- Prefer soft deletion and restoration through existing unique business keys.
  Do not physically delete users, words, or favorites.
- Keep history immutable and append-only. Historical queries must remain
  readable when a related mutable entity is soft-deleted.
- Use restrictive foreign keys for audited relationships unless a documented
  domain rule requires physical cascading deletion.

## Security and Observability

- Hash passwords with Argon2id. Never store or log plaintext passwords.
- Treat JWT as signed and encoded, not encrypted.
- Use TLS in deployed environments and do not introduce reversible encryption
  without a concrete sensitive-data requirement.
- Configure Helmet, CORS allowlists, authentication rate limits, and request
  validation.
- Add a correlation ID to requests and structured logs.
- Use `transactionId` as the canonical trace field and propagate it through
  asynchronous jobs. Keep `x-correlation-id` only as a compatible HTTP alias.
- Redact authorization headers, cookies, passwords, hashes, and tokens.
- Route application logs through the shared Winston adapter. Do not call
  `console.*`, instantiate ad hoc loggers, or send directly to Better Stack.
- Payloads, responses, and errors must pass through the shared recursive
  sanitizer and its depth, array, string, and serialized-size limits.
- Logging and Better Stack ingestion must never determine whether a business
  operation succeeds.
- Return human-readable errors while retaining diagnostic context in server
  logs.
- Add `x-response-time` to API responses and `x-cache` to cacheable endpoints.

## Testing Rules

- Unit-test domain rules and use cases with mocks, stubs, spies, fakes, and
  builders where each test double has a clear purpose.
- Integration-test Prisma, Redis, BullMQ, and external API adapters.
- End-to-end test authentication, listing, cache HIT/MISS, details, history,
  favorites, and error responses.
- Stub the external Dictionary API in automated tests.
- Global thresholds: 80% statements, lines, and functions; 75% branches.
- Domain and application thresholds: 90% statements and lines.
- Tests must be deterministic and must not depend on execution order.

## Quality Gate

Before a delivery commit or push, run:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm test:coverage`
5. `pnpm build`

The repository must also remain reproducible through Docker Compose.
