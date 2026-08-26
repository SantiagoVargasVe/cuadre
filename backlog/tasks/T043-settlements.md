---
id: T043
title: Settlements schema and endpoints
epic: E5-balances
status: done
depends_on: [T040, T021]
size: M
---

## Context

Recording that a payment happened. It is a plain ledger entry, deliberately **not** attached to a
debt or a plan edge — which is what lets it compose with simplification without any reconciliation
logic anywhere in the codebase.

Read [ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md) and
[splitting.md](../../docs/context/splitting.md) § 7.

## Acceptance criteria

- [x] `settlements`: `id`, `group_id`, `from_user_id`, `to_user_id`, `amount bigint`,
      `currency → currencies`, `settled_on date`, `note` nullable, `created_by`, `deleted_at`,
      timestamps
- [x] `CHECK (from_user_id <> to_user_id)`, `CHECK (amount > 0)`
- [x] Composite FKs to `group_members` for **both** participants, same as expense children
- [x] **No link to an expense, a pair balance, or a plan edge.** If a column appears here that
      references one, it contradicts the ADR
- [x] `POST /api/groups/:id/settlements { toUserId, amount, currency, settledOn, note? }`
- [x] `from_user_id` is **always the authenticated user**. Recording a payment on someone else's
      behalf is not in v1
- [x] `PATCH` / `DELETE /api/settlements/:id` — soft delete, same rules as expenses, group resolved
      from the row
- [x] `GET /api/groups/:id/settlements` paginated like the expense feed
- [x] **Over- and under-payment are normal.** Nothing validates the amount against a suggested
      plan edge. Someone owing `47.300` sending a round `50.000` is the expected case, and the
      remainder simply flips sign
- [x] `note` ≤ 500 chars
- [x] Tests: a settlement clears a debt exactly; one overshooting flips the sign; a settlement
      involving a non-member is rejected; a deleted settlement stops affecting balances; the
      balance effect is identical with simplify on and off

## Out of scope

The settle-up UI (T067). Marking a plan edge as paid — that concept does not exist here.

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/app/api/groups/[id]/settlements/route.ts
src/app/api/settlements/[id]/route.ts
src/server/services/settlements.ts
```

## Implementation notes

No `version` column and no revisions table, unlike expenses — confirmed against
data-model.md's own settlements definition, which lists neither. splitting.md §7's "same
soft-delete and versioning rules as an expense" reads more naturally as "soft-delete, and
editable via a full-replace PATCH," not "needs its own diffable revision history" — a settlement
is a single flat fact (one amount, one date, one note), so there's nothing here a snapshot table
would add over the row itself.

`src/server/services/balances.ts` also needed extending — its own comment already flagged this
("extend this same UNION when T043 adds settlements, rather than adding separate queries"), so
`loadLedgerRows` now unions in `sent`/`received` from `settlements` alongside the existing
`paid`/`owed` from expenses, and `getGroupBalances` no longer hardcodes `sent: []`/`received: []`.
Without this, settlements would exist but have zero actual effect on `net()` — the entire point
of ADR-0009.

**Bug caught during verification, not by lint or typecheck:** `db.update(settlements).set({ note:
input.note, ... })` silently *keeps* the existing note when `input.note` is `undefined` (a PATCH
that omits `note` to clear it) — drizzle's `.set()` skips keys with an `undefined` value rather
than nulling the column, since JS itself can't distinguish "not provided" from "explicitly
undefined" once it reaches `.set()`'s object argument. This would have quietly broken the "PATCH
replaces the whole settlement" contract for exactly the one field that's optional. Fixed with
`note: input.note ?? null` on both create and update, verified with a raw-SQL check against a real
insert/update before writing the regression test (`"PATCH omitting note clears an existing one,
not silently keeps it"` in `settlements.test.ts`).
