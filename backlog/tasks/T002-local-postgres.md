---
id: T002
title: Local Postgres and validated environment config
epic: E1-foundation
status: done
depends_on: [T001]
size: S
---

## Context

Postgres 17 in Docker for development, plus the config module every other module reads instead of
touching `process.env`. Getting the second one right early is what stops "undefined is not a
connection string" appearing three tasks later.

Read [architecture.md](../../docs/context/architecture.md) and the `.env.example` at the repo
root — it already names every variable this app will need.

## Acceptance criteria

- [x] `infra/docker-compose.dev.yml` with `postgres:17-alpine`, a named volume, and a healthcheck
- [x] `infra/postgres-init/01-create-test-db.sql` creating `cuadre_test` on a fresh volume —
      integration tests need it and it must exist before anyone writes one
- [x] `db:up` waits for **healthy**, not just started. `db:down`, `db:logs`, `db:reset`
- [x] All `db:*` scripts pass `--project-directory .` so `.env` resolves from the repo root —
      without it compose silently reads `infra/.env` and the failure is baffling
- [x] `src/server/config.ts` validates the environment **once at boot** with Zod and fails with a
      message naming exactly what is wrong. No defaults for secrets
- [x] `AUTH_SECRET` is rejected below 32 characters rather than accepted and weak
- [x] `SUPPORTED_CURRENCIES` parses to a non-empty set, and `DEFAULT_CURRENCY` must be in it
- [x] `src/server/config.schema.ts` holds the schema separately, importable by tooling that runs
      outside Next (`drizzle.config.ts`) without tripping the `server-only` guard
- [x] `config.ts` carries `import "server-only"`; nothing under `src/app/**` can import it
- [x] Tests: a missing required var fails with its name in the message; a short `AUTH_SECRET` is
      rejected; a `DEFAULT_CURRENCY` outside `SUPPORTED_CURRENCIES` is rejected

## Out of scope

Drizzle, schema, migrations (T003). Any table.

## Files likely touched

```
infra/docker-compose.dev.yml
infra/postgres-init/01-create-test-db.sql
src/server/config.ts
src/server/config.schema.ts
package.json
```
