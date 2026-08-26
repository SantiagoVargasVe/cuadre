---
id: T020
title: Schema for currencies, groups, and group members
epic: E3-groups
status: done
depends_on: [T010]
size: M
---

## Context

The tables the whole product hangs off. Two details here are load-bearing far beyond this task:
the `currencies` lookup table is where the ISO minor-unit exponent lives authoritatively, and the
composite key on `group_members` is what lets expense rows carry a database-enforced "this person
is actually in this group" guarantee.

Read [data-model.md](../../docs/context/data-model.md) § *currencies*, § *groups*,
§ *group_members*, and [currency.md](../../docs/context/currency.md) § *Supported currencies*.

## Acceptance criteria

- [x] `currencies`: `code char(3) pk`, `exponent smallint`, `display_decimals smallint`, `name`.
      Seeded by migration with COP, USD, EUR
- [x] **COP seeds as `exponent 2, display_decimals 0`.** They differ on purpose — ISO gives COP two
      minor digits and Colombians write none. See
      [ADR-0004](../../docs/adr/0004-money-as-integer-minor-units.md)
- [x] `groups`: `id uuid pk`, `title`, `description`, `default_currency → currencies`,
      `display_currency → currencies` **nullable**, `simplify_debts boolean default false`,
      `created_by`, `archived_at` nullable, timestamps
- [x] `group_members`: composite pk `(group_id, user_id)`, `role` (`owner | member`), `joined_at`,
      `removed_at` nullable
- [x] **An explicit `UNIQUE (group_id, user_id)`** even though it is the primary key — child tables
      reference it as a composite foreign key in T033, and a pk alone won't serve as the FK target
      in every Postgres formulation. Write it and note why in the migration
- [x] Add the deferred `invite_codes.group_id` FK left open by T010
- [x] Index on `group_members(user_id) WHERE removed_at IS NULL` — "my groups" is the app's most
      frequent query
- [x] Members are **never hard-deleted**; `removed_at` retires them. Historical expenses reference
      the row, so it must survive
- [x] Migration reviewed and committed with the schema

## Out of scope

Group CRUD (T022), membership guards (T021), invites (T023), `fx_rates` (T050).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
```
