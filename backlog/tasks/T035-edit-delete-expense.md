---
id: T035
title: Edit and delete an expense, with expense_revisions
epic: E4-money
status: done
depends_on: [T034]
size: M
---

## Context

Shared-money history is the product. "This said I owed 40.000 yesterday" has to be answerable,
which is why every change writes a full snapshot rather than an audit line, and why nothing here
hard-deletes.

Read [data-model.md](../../docs/context/data-model.md) § *expense_revisions* and
§ *Deletion semantics*.

## Acceptance criteria

- [x] `expense_revisions`: `id`, `expense_id`, `version`, `action` (`created|updated|deleted`),
      `snapshot jsonb`, `changed_by`, `changed_at`, unique `(expense_id, version)`
- [x] The snapshot holds the expense **and** its payer/split rows — enough to reconstruct what the
      ledger said, not just which columns changed
- [x] Written in the **same transaction** as the change, never after
- [x] `PATCH /api/expenses/:id` **replaces the whole expense** — payers and splits included — and
      bumps `version`. There is no partial split patch: resolving a half-updated split against a
      stale total is a state nobody should have to reason about
- [x] The route carries no group id — **load the row, read its `group_id`, then check membership.**
      This is the case where the check gets forgotten
- [x] Re-resolution on edit reuses the **same expense id as the seed**, so an unrelated edit doesn't
      silently reshuffle which member absorbed the remainder
- [x] `DELETE /api/expenses/:id` sets `deleted_at` and writes a `deleted` revision. Nothing is
      hard-deleted
- [x] Deleted expenses vanish from balances via `liveExpenses`; their revisions survive
- [x] **Any member may edit or delete any expense in their group**, including one they didn't
      create. The revision history is what makes that safe, not permissions — see
      [security.md](../../docs/context/security.md) § *Known accepted risks*
- [x] `updated_by` is set on every edit
- [x] Editing in an archived group is refused
- [x] Tests: an edit writes version 2 with a complete snapshot; delete removes it from balances and
      keeps revisions; a non-member gets `404` on both; re-resolution is stable across an unrelated
      title edit

## Out of scope

A visible diff viewer (T083, post-MVP). Restoring a deleted expense.

## Files likely touched

```
src/app/api/expenses/[id]/route.ts
src/server/services/expenses.ts
src/server/db/schema.ts
src/server/db/migrations/
```
