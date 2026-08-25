---
id: T013
title: Session helper, typed domain errors, and the error → HTTP mapper
epic: E2-auth
status: done
depends_on: [T012]
size: S
---

## Context

Every route handler and every service uses these. Building them once, early, is what stops
response shapes drifting endpoint by endpoint — and the structured `details` payload is not
cosmetic, because the split editor renders the balance difference live from it.

Read [api-contract.md](../../docs/context/api-contract.md) § *Conventions* and
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md) § *Errors*.

## Acceptance criteria

- [x] `requireUserId()` — throws `UnauthorizedError` when there's no session. Route handlers call
      it first
- [x] Typed domain errors: `UnauthorizedError`, `NotFoundError`, `ForbiddenError`,
      `ConflictError`, `ValidationError`, `RateLimitError`
- [x] Each carries a stable `code` and optional structured `details`
- [x] **One mapper** converts them to `{ error: { code, message, details } }` with the right
      status. Services never build response objects
- [x] `429` responses carry `Retry-After`
- [x] Unmapped errors become a generic `500` — internals never reach the client — and are logged
      with a request id
- [x] Logs never contain password hashes, tokens, rate-limit keys, or email addresses
- [x] Tests: each error type maps to the documented status; an unmapped error yields a `500` whose
      body contains nothing internal

## Out of scope

`requireMembership` / `requireOwner` (T021 — they need `groups` to exist).

## Files likely touched

```
src/server/errors.ts
src/server/http/map-error.ts
src/server/auth/session.ts
```
