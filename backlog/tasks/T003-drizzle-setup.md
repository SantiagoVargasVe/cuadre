---
id: T003
title: Drizzle wiring, migration pipeline, and the real-Postgres test harness
epic: E1-foundation
status: done
depends_on: [T002]
size: M
---

## Context

Drizzle plus the harness that lets integration tests run against a **real** database. That harness
is not a convenience: the invariants that matter most in this app — the deferred balance trigger,
the composite membership FK, the conditional invite consumption — are enforced by Postgres, and a
mocked Drizzle accepts every one of them without complaint.

Read [testing.md](../../docs/context/testing.md) § *How* and
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md) § *Migrations*.

## Acceptance criteria

- [x] `drizzle.config.ts` importing `config.schema.ts`, not `config.ts`
- [x] `src/server/db/client.ts` — a single pooled client, imported only by services
- [x] `db:generate`, `db:migrate`, `db:studio`
- [x] Migrations run at app startup **in production only**, via `src/instrumentation.ts`. Document
      inline that this is safe at exactly one instance and races with replicas
- [x] A test harness that, per test file: connects to `DATABASE_URL_TEST`, runs migrations once,
      and **truncates between tests** rather than recreating the database
- [x] Integration tests **skip** when `DATABASE_URL_TEST` is unset, so unit tests still run without
      Docker — and **fail** when it's unset in CI, because a silent skip there is
      indistinguishable from a pass. Assert this via `process.env.CI`
- [x] A `withTransaction` helper services use for multi-step writes
- [x] A trivial smoke migration + test proving the whole loop works end to end

## Out of scope

Any application table. `users` is T010, `groups` is T020, `expenses` is T033.

## Files likely touched

```
drizzle.config.ts
src/server/db/{client,schema,migrate}.ts
src/server/db/migrations/
src/test/db.ts
src/instrumentation.ts
```
