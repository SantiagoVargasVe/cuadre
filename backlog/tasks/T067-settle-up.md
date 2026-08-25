---
id: T067
title: Settle-up flow
epic: E7-frontend
status: todo
depends_on: [T066, T043]
size: S
---

## Context

Recording a payment. The one thing to hold onto: the app is not confirming a suggested payment,
it's recording a fact — so the amount must be editable and any amount must be accepted.

Read [ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md).

## Acceptance criteria

- [ ] "Registrar pago" from a plan edge **prefills** `to`, amount, and currency
- [ ] **The amount stays editable and any positive amount is accepted.** Someone owing `47.300`
      sending a round `50.000` is the expected case, not an error
- [ ] The prefill is a convenience only — **nothing links the settlement back to the plan edge**,
      and no code should look for such a link
- [ ] Also reachable without a plan edge: pick a member, enter an amount
- [ ] Date defaults to today; optional note, ≤ 500 chars
- [ ] Optimistic update is fine here — a settlement is a single amount the client already knows
- [ ] On success, invalidate balances **and** the settlements list
- [ ] Settlement history is visible and its entries are editable/deletable by the same rules as
      expenses
- [ ] Tests: prefill from an edge; an over-payment submits and flips the net sign; optimistic
      rollback on failure with a toast

## Out of scope

Moving actual money. Cuadre records that a payment happened and never touches a payment rail.

## Files likely touched

```
src/app/g/[groupId]/_components/settle-up-dialog.tsx
src/app/g/[groupId]/_components/settlement-list.tsx
```
