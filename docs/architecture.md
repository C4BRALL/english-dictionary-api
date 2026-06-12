# Architecture

The solution is a pnpm and Turborepo monorepo with three independently
executable applications and four business packages.

```mermaid
flowchart TD
  API["apps/api<br/>HTTP composition root"]
  Worker["apps/worker<br/>Queue composition root"]
  Importer["apps/importer<br/>Import composition root"]
  Infrastructure["packages/infrastructure<br/>Adapters"]
  Application["packages/application<br/>Use cases and ports"]
  Domain["packages/domain<br/>Business model"]
  Contracts["packages/contracts<br/>Shared job contracts"]
  PostgreSQL[("PostgreSQL")]
  Redis[("Redis")]
  Dictionary["Free Dictionary API"]

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
```

## Dependency Rules

- Domain code has no framework or infrastructure dependencies.
- Application code defines ports and coordinates domain behavior.
- Infrastructure adapters implement application ports.
- Apps wire concrete implementations and own process lifecycle.
- Shared imports use package root exports rather than internal file paths.

## Runtime Processes

- `api` serves the challenge HTTP contract.
- `worker` processes asynchronous favorite commands.
- `importer` downloads and imports the English word list as an explicit one-shot
  operation.
- PostgreSQL is the source of truth.
- Redis provides caching and BullMQ transport.
