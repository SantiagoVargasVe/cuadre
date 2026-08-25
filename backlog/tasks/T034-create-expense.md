---
id: T034
title: POST /api/groups/:id/expenses
epic: E4-money
status: todo
depends_on: [T033, T031, T021]
size: M
---

## Context

Where a strategy from the client becomes resolved amounts in the database. The rule that governs
this endpoint: **the client sends intent, the server computes the numbers.** Even when the client
supplies amounts (`exact`), the server validates rather than trusts.

Read [api-contract.md](../../docs/context/api-contract.md) § *Expenses* and
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md) § *Writing an expense*.

## Acceptance criteria

- [ ] `POST /api/groups/:id/expenses` → `201`, with membership verified **inside the service**
- [ ] Payload per the API contract: `title`, `date`, `amount` (string minor units), `currency`,
      `paidBy[]`, `split`
- [ ] **`paidBy` omitted defaults to the authenticated user paying the full amount**, and
      `split.strategy: "equal"` with no member list means every current member. The common case
      must cost the client nothing
- [ ] The split is resolved through `src/lib/money/` using the **expense id as the apportionment
      seed** — so generate the id before resolving, not after
- [ ] `Σ payers == total == Σ splits` asserted **before** the transaction opens, so the error names
      the difference
- [ ] One transaction: `expenses` → `expense_payers` + `expense_splits` (with `group_id`) →
      `expense_revisions` version 1. The deferred trigger re-validates at commit
- [ ] Response echoes the **resolved** per-member amounts, so the client never re-derives them and
      can never disagree with the server about who owes what
- [ ] Typed errors with structured details: `SPLITS_DO_NOT_BALANCE`, `PAYERS_DO_NOT_BALANCE`,
      `PERCENTAGES_DO_NOT_SUM`, `NOT_A_MEMBER` (with `details.userIds`),
      `CURRENCY_NOT_SUPPORTED` — all `422`
- [ ] A payer or split member who is not a current member is rejected by the service **and** by the
      composite FK. Both paths tested
- [ ] `expense_date` bounded to a sane range so a fat-fingered year can't produce a feed spanning
      four millennia
- [ ] Writing to an archived group is refused
- [ ] Tests: each strategy round-trips to the amounts [splitting.md](../../docs/context/splitting.md)
      specifies; multi-payer balances; a non-member payer is rejected; `100.000` three ways lands
      on `33.333/33.334/33.333`

## Out of scope

Edit and delete (T035). Reading expenses back (T036). The form UI (T064, T065).

## Files likely touched

```
src/app/api/groups/[id]/expenses/route.ts
src/server/services/expenses.ts
src/lib/schemas/expenses.ts
```
