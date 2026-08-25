---
id: T011
title: POST /api/auth/register with transactional invite consumption
epic: E2-auth
status: done
depends_on: [T010]
size: M
---

## Context

Registration, and the first place a race condition can cost real money — two people redeeming one
single-use code. The transaction here also has to insert a group membership when the code carries
a `group_id`, which is what makes one WhatsApp link work for people who do and don't already have
accounts.

Read [ADR-0002](../../docs/adr/0002-invite-only-registration.md) and
[security.md](../../docs/context/security.md) § *Invite codes*.

## Acceptance criteria

- [x] `POST /api/auth/register { email, displayName, password, inviteCode }` → `201 { user }`
- [x] Argon2id via `@node-rs/argon2`
- [x] **One transaction**: create user → consume the code → insert `group_members` if the code
      carries a `group_id`. All of it commits or none does. A burned code with no account is the
      failure being prevented
- [x] Consumption is a **conditional update** — `UPDATE … WHERE consumed_at IS NULL RETURNING` —
      and zero rows returned is a `409`. Check-then-insert races, and this is the exact endpoint
      where that matters
- [x] Expired and already-consumed codes are **indistinguishable** in the response. Both are
      "invalid"
- [x] Duplicate email returns `409` without revealing whether the address exists elsewhere in a
      timing-observable way
- [x] Password minimum length enforced by the Zod schema shared with the frontend
- [x] Rate limited by IP **before** the Argon2 hash is computed — hashing first makes the endpoint
      a free CPU-exhaustion primitive
- [x] Sets the session cookie on success, so registering logs you in
- [x] Tests, including the one that matters: **two concurrent registrations against one code —
      exactly one succeeds, the other gets `409`.** Real Postgres, genuinely concurrent

## Out of scope

Login (T012), the register page (T014), minting invites from the UI (T023).

## Files likely touched

```
src/app/api/auth/register/route.ts
src/server/services/auth.ts
src/server/services/invites.ts
src/lib/schemas/auth.ts
```
