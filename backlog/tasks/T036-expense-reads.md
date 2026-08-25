---
id: T036
title: Expense list and detail endpoints
epic: E4-money
status: todo
depends_on: [T034]
size: S
---

## Context

The group feed's data. Straightforward, with one thing worth getting right: the list is the app's
most-hit endpoint and must not fan out per expense.

Read [api-contract.md](../../docs/context/api-contract.md) § *Expenses* and § *Conventions*
(pagination).

## Acceptance criteria

- [ ] `GET /api/groups/:id/expenses?cursor=&limit=` → `{ items, nextCursor }`, default 50, max 200
- [ ] Cursor-based, ordered by `expense_date DESC, id DESC` — a stable tiebreak, or pagination
      duplicates rows on a day with several expenses
- [ ] Each item carries its resolved payers and splits with display names, **in one query**. No
      N+1 across expenses
- [ ] `GET /api/expenses/:id` → the same shape, plus `version` and `editedAt`
- [ ] Deleted expenses excluded via `liveExpenses`
- [ ] Membership verified inside the service; the id-addressed route resolves the group from the row
- [ ] Amounts serialized as **strings** of minor units
- [ ] Tests: pagination is stable across several same-day expenses; a deleted expense is absent;
      a non-member gets `404`; the list issues a bounded number of queries regardless of page size

## Out of scope

Balances (T044). The feed UI (T063). Filtering and search — not in v1.

## Files likely touched

```
src/app/api/groups/[id]/expenses/route.ts
src/app/api/expenses/[id]/route.ts
src/server/services/expenses.ts
```
