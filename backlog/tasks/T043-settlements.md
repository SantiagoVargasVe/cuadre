---
id: T043
title: Settlements schema and endpoints
epic: E5-balances
status: todo
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

- [ ] `settlements`: `id`, `group_id`, `from_user_id`, `to_user_id`, `amount bigint`,
      `currency → currencies`, `settled_on date`, `note` nullable, `created_by`, `deleted_at`,
      timestamps
- [ ] `CHECK (from_user_id <> to_user_id)`, `CHECK (amount > 0)`
- [ ] Composite FKs to `group_members` for **both** participants, same as expense children
- [ ] **No link to an expense, a pair balance, or a plan edge.** If a column appears here that
      references one, it contradicts the ADR
- [ ] `POST /api/groups/:id/settlements { toUserId, amount, currency, settledOn, note? }`
- [ ] `from_user_id` is **always the authenticated user**. Recording a payment on someone else's
      behalf is not in v1
- [ ] `PATCH` / `DELETE /api/settlements/:id` — soft delete, same rules as expenses, group resolved
      from the row
- [ ] `GET /api/groups/:id/settlements` paginated like the expense feed
- [ ] **Over- and under-payment are normal.** Nothing validates the amount against a suggested
      plan edge. Someone owing `47.300` sending a round `50.000` is the expected case, and the
      remainder simply flips sign
- [ ] `note` ≤ 500 chars
- [ ] Tests: a settlement clears a debt exactly; one overshooting flips the sign; a settlement
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
