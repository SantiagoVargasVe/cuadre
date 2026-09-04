---
id: T119
title: Schema — auth_tokens, email_verified_at, sessions_valid_from
epic: E15-account-recovery
status: done
depends_on: []
size: S
---

## Context

The storage for the whole epic, in one migration. A reset token has to be single-use, which is why
it needs a table rather than a signed JWT — read
[ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md) § *Why not a JWT* before
proposing a stateless alternative.

Unlike the sibling repo, which added verification after reset had already shipped, both purposes
are known here before anything is written. So there is one table with a `purpose` enum from its
first migration, named `auth_tokens` rather than `password_reset_tokens` — there is no history to
be honest about, so the name should be. See
[ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md) § *Why one token table*.

`sessions_valid_from` is the smallest change here and the most consequential: it is what makes a
JWT revocable, which [ADR-0003](../../docs/adr/0003-jwt-cookie-and-bearer.md) explicitly deferred.
T123 enforces it; this task only adds the column, so the two can land and be reviewed separately.

Read [data-model.md](../../docs/context/data-model.md) § *users*, ADR-0012, and ADR-0013. Schema
only — no service code, no endpoints.

## Acceptance criteria

- [ ] `auth_token_purpose` pgEnum (`password_reset` | `email_verify`), following
      `legal_document` and `split_strategy` — not text plus a CHECK
- [ ] `auth_tokens` in `src/server/db/schema.ts`: `token_hash` text primary key · `user_id` uuid
      not null referencing `users.id` `ON DELETE CASCADE` · `purpose` not null ·
      `expires_at` timestamptz not null · `used_at` timestamptz nullable · `created_at`
      timestamptz not null default `now()`
- [ ] Index on `(user_id, purpose)` — "delete this user's other outstanding tokens of this kind" is
      a real query path in T122, and it is always purpose-scoped
- [ ] A schema comment stating that only the SHA-256 of a token is ever stored here, and why that
      is not Argon2 (ADR-0012 § *Why SHA-256*). The next person to read this table will ask
- [ ] `users.email_verified_at` timestamptz, **nullable**. Null means unverified. No boolean — the
      timestamp answers *when*, which a boolean can't, and this is an audit trail
- [ ] **No backfill of `email_verified_at`.** Every existing row stays null.
      [ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md) § *Existing accounts are
      not backfilled* is the reasoning, including why T118's `legacy_backfill` precedent does not
      transfer. If a reviewer asks for one, point them there
- [ ] `users.sessions_valid_from` timestamptz **not null**, defaulting to
      `date_trunc('second', now())`. Not nullable: a null forces every read site to decide what
      null means, and the answer is always "the account's epoch". Truncated to the second because
      a JWT `iat` is whole seconds and T123's check must be a plain comparison, not a rounding
      exercise — ADR-0012 § *The `iat` granularity trap*
- [ ] Existing rows backfill `sessions_valid_from` to `date_trunc('second', now())` at migration
      time — not epoch, which is a silent no-op, and not a future value, which logs everyone out
      on deploy
- [ ] Migration generated with `npm run db:generate` and committed. It applies cleanly on a fresh
      volume (`npm run db:reset && npm run db:migrate`) **and** on top of the current production
      schema
- [ ] Real-Postgres schema tests in the existing pattern: cascade delete removes a user's tokens;
      `token_hash` rejects duplicates; the enum rejects an unknown purpose; a new user's
      `sessions_valid_from` is exactly on a second boundary
- [ ] `data-model.md` documents `auth_tokens` and both new `users` columns, including the
      truncation rule and the retention note from ADR-0012

## Out of scope

Minting, hashing, consuming, endpoints, mail, and the `currentUserId` check — T122, T123, T124,
T125. Any other change to `users`. Any sweep job for spent tokens.

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/0011_account_recovery.sql
src/server/db/schema.test.ts
docs/context/data-model.md
```
