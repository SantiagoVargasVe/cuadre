---
id: T083
title: Expense revision history as a visible diff
epic: E9-insights
status: todo
depends_on: [T035, T036]
size: M
---

## Context

`expense_revisions` has recorded a full snapshot of every change since T035 — the schema comment
says outright that "MVP writes these and exposes *edited* + who + when; the full diff viewer is
E9." This is that viewer. The data already exists; nothing here needs a migration.

This directly serves the product's stated worst case: CLAUDE.md non-negotiable #7 calls a silent
overwrite of who-owed-what "the worst bug this app can have". Today a member can see *that* an
expense was edited and by whom, but not **what changed** — which is exactly the question that gets
asked when the number someone remembers disagrees with the number on screen.

Read [data-model.md](../../docs/context/data-model.md) § *expense_revisions*,
[api-contract.md](../../docs/context/api-contract.md) § *Expenses*,
[security.md](../../docs/context/security.md), and
[design-system.md](../../docs/frontend/design-system.md).

## Acceptance criteria

- [ ] `GET /api/expenses/:id/revisions` → `200 { revisions[] }`, newest first, each carrying
      `version`, `action`, `changedAt`, and `changedBy` (`{ userId, displayName }` or `null` — the
      FK is `ON DELETE SET NULL`, so "when" and "who" are independent)
- [ ] **This is an id-addressed route — the classic authorization trap.** The expense carries no
      group id in the URL: load the row, read *its* `group_id`, then verify membership **inside the
      service**. Non-member and removed member get `404`. An unguessable UUID is not an
      authorization check. Add the test alongside the existing id-addressed route tests
- [ ] The response never leaks an email address, in any nested snapshot field
- [ ] The diff is computed **server-side** between consecutive snapshots and returned as structured
      changes — the client renders, it does not diff. Cover, at minimum: `title`, `expenseDate`,
      `totalAmount`, `currency`, `splitStrategy`, the payer set, and the split set (per member:
      added, removed, or amount changed)
- [ ] **Money in a diff goes through `<Money>` like money anywhere else** — old and new as
      rendered amounts, never a raw minor-unit integer and never a formatted string built inline.
      A currency change renders both sides with their own currency
- [ ] The `created` revision renders as "creó el gasto", not as a diff against nothing. A `deleted`
      revision renders as a deletion. Neither is a special case the UI has to guess at
- [ ] UI: a "Historial" section in the expense detail, collapsed by default so it never competes
      with the split breakdown T102 just made discoverable. Every string via i18n keys. Works at
      375px
- [ ] A never-edited expense (`version === 1`) shows its creation entry, not an empty state that
      reads like an error
- [ ] Behaviour for a soft-deleted expense mirrors whatever `GET /api/expenses/:id` already does —
      do not invent a second rule here
- [ ] Tests: authorization (non-member `404`, removed member `404`); a title-only edit produces
      exactly one field change; a split change lists per-member deltas; a multi-payer edit;
      `changedBy: null` renders without crashing; the money in a diff is asserted as `bigint`, not
      as a formatted string
- [ ] `docs/context/api-contract.md` documents the endpoint

## Out of scope

- **Restoring or reverting to a past revision.** A genuinely different feature with real questions
  about what it does to balances — write it up separately if it's ever wanted
- Settlement history. `settlements` deliberately has no revisions table (see its schema comment)
- A group-wide activity feed across all expenses — that is T084 territory at most
- Any change to what T035 writes. This task is read-only over existing data

## Files likely touched

```
src/app/api/expenses/[id]/revisions/route.ts
src/server/services/expenses-revisions.ts
src/lib/money/... (only if a diff helper genuinely earns a file)
src/app/(app)/g/[groupId]/_components/ExpenseHistory.tsx
src/app/(app)/g/[groupId]/_components/RevisionEntry.tsx
src/app/(app)/g/[groupId]/_components/ExpenseDetail.tsx
src/lib/i18n/es.ts
docs/context/api-contract.md
```
