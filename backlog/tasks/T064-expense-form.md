---
id: T064
title: Expense form — the common case in under fifteen seconds
epic: E7-frontend
status: done
depends_on: [T063, T034]
size: M
---

## Context

**The screen that decides whether this app gets used.** Someone standing at a restaurant table has
to add an expense before the conversation moves on. All the flexibility from E4 is real and must
be reachable — and must cost the common case nothing.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The expense form* and
[product.md](../../docs/context/product.md) § *Core flows*.

## Acceptance criteria

- [x] Full-screen sheet on mobile, dialog on desktop, with **the amount field focused on open**
- [x] Everything pre-filled: currency → the group's default, date → today, paid by → you for the
      full amount, split → every member equally
- [x] **Title, amount, save.** That path must require no other interaction
- [x] "Pagado por" and "Dividido" are **two lines of text that open editors when tapped** — not two
      always-open pickers
- [x] Amount uses `<MoneyField>`; `bigint` minor units out at submit
- [x] Currency selector limited to `SUPPORTED_CURRENCIES`
- [x] The payer editor supports **multiple payers with amounts**, showing a live remainder against
      the total, and defaults to a single payer
- [x] Save disabled while the form is invalid or in flight
- [x] **Never optimistic.** The server resolves the split; guessing its answer is how client and
      server end up disagreeing about who owes what
- [x] On success, invalidate the group's expenses **and balances** query keys. A stale balance after
      an add is the most damaging wrong number this app can show
- [x] API `422`s render against the right control, using `details` rather than a generic message
- [x] Tests: the default path submits the documented minimal payload; multi-payer submits and shows
      a live remainder; balances are invalidated on success

## Out of scope

The split editor itself (T065) — this task ships with `equal` and the payer editor, and mounts
T065's component where the split editor goes.

## Files likely touched

```
src/app/g/[groupId]/_components/expense-form.tsx
src/app/g/[groupId]/_components/payer-editor.tsx
src/lib/schemas/expenses.ts
```
