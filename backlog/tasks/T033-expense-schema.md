---
id: T033
title: Expense schema, deferred balance trigger, composite membership FKs
epic: E4-money
status: done
depends_on: [T020, T003]
size: M
---

## Context

The ledger tables, and the two database-level guarantees that make this app's data trustworthy: an
expense cannot be unbalanced, and a non-member cannot appear on one. Both are enforced by Postgres
rather than by application code, because this is the one class of corruption with no recovery —
there is no external source to re-derive a trip's ledger from.

Read [data-model.md](../../docs/context/data-model.md) § *expenses* through
§ *The balanced-expense constraint*, and
[ADR-0005](../../docs/adr/0005-expense-as-balanced-ledger-entry.md).

## Acceptance criteria

- [x] `expenses`: `id`, `group_id`, `title`, `expense_date date`, `total_amount bigint`,
      `currency → currencies`, `split_strategy`, `created_by`, `updated_by`, `version`,
      `deleted_at`, timestamps
- [x] **`expense_date` is a calendar `date`** — no time, no zone. A trip crossing timezones must
      not shift an expense onto another day
- [x] **No `paid_by` column.** [ADR-0005](../../docs/adr/0005-expense-as-balanced-ledger-entry.md)
- [x] `expense_payers` and `expense_splits`: `(expense_id, user_id)` pk, `group_id`,
      `amount bigint`, and `weight bigint` nullable on splits to round-trip the raw input
- [x] `CHECK (amount > 0)` on both, `CHECK (total_amount > 0)` on the parent
- [x] Both child tables carry a **denormalized `group_id`** solely to support
      `FOREIGN KEY (group_id, user_id) REFERENCES group_members (group_id, user_id)`. That makes
      "you cannot put a non-member on an expense" a database guarantee. Document why the column
      exists, or someone will normalize it away
- [x] **A `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`** validating
      `Σ payers == total == Σ splits` **at commit time**. It must be deferred: rows are inserted in
      arbitrary order within the transaction and an immediate trigger fires before the last lands
- [x] `split_strategy` constrained to the six values, and documented in the migration as
      **advisory** — the balance engine never reads it; the resolved amounts are the truth
- [x] Index on `expenses(group_id, expense_date DESC) WHERE deleted_at IS NULL` — the feed's only
      query
- [x] A `liveExpenses` query helper applying `deleted_at IS NULL`, so it cannot be forgotten
- [x] The trigger and composite FKs are **hand-written SQL inside the generated migration** —
      Drizzle won't produce them. Comment them so the next person doesn't tidy away what looks
      like stray SQL
- [x] Tests against real Postgres, **with the service bypassed**: an unbalanced insert aborts the
      transaction; a non-member on a split is rejected by the FK; a balanced insert commits

## Out of scope

The create endpoint (T034). Edit/delete (T035). `settlements` (T043).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/server/db/helpers.ts
```
