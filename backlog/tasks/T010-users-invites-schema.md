---
id: T010
title: Schema for users and invite codes, plus the seed:invite script
epic: E2-auth
status: done
depends_on: [T003]
size: S
---

## Context

The first real tables, and the bootstrap path — without `seed:invite` there is no way to create
the first account, because registration is invite-only.

The single-table design for invites is deliberate and load-bearing: one code serves as both a
registration invite and a group invite. Read
[ADR-0002](../../docs/adr/0002-invite-only-registration.md) before writing the schema, and
[data-model.md](../../docs/context/data-model.md) § *users* and § *invite_codes*.

## Acceptance criteria

- [x] `users`: `id uuid pk`, `email citext unique`, `display_name`, `password_hash`, timestamps.
      Enable the `citext` extension in the migration
- [x] **No role column.** Authorization here is membership-based
- [x] `invite_codes`: `code` pk (16-char nanoid), `created_by`, **`group_id` nullable**,
      `expires_at` nullable, `consumed_by` nullable, `consumed_at` nullable, `created_at`
- [x] `group_id` FK is added in T020 when `groups` exists — leave the column, note the follow-up in
      the migration
- [x] Index on `invite_codes(consumed_at) WHERE consumed_at IS NULL`
- [x] `npm run seed:invite` mints a code and prints it, accepting an optional `--expires` and
      `--group`
- [x] Migration generated via `db:generate`, SQL reviewed, committed with the schema

## Out of scope

Registration (T011), consumption logic (T011), group membership (T020).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
scripts/seed-invite.ts
```
