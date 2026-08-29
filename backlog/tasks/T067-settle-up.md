---
id: T067
title: Settle-up flow
epic: E7-frontend
status: done
depends_on: [T066, T043]
size: S
---

## Context

Recording a payment. The one thing to hold onto: the app is not confirming a suggested payment,
it's recording a fact — so the amount must be editable and any amount must be accepted.

Read [ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md).

## Acceptance criteria

- [x] "Registrar pago" on a plan edge (only where `edge.from === myUserId`, since `fromUserId` is
      always the acting user — ADR-0009) **prefills** `to`, amount, and the block's currency
- [x] The amount stays editable; **any positive amount is accepted** (`settlementFormSchema` only
      rejects ≤ 0). Owing 47.300 and sending 50.000 submits `amount: "5000000"`
- [x] Prefill is convenience only — `SettleUpDialog` takes a plain `{ toUserId, amountMinor }`,
      writes a plain settlement, and nothing reads a link back to the edge
- [x] Standalone entry: a "Registrar pago" button in the Balances header opens the same dialog
      with a member picker and an empty amount, currency = group default
- [x] Date defaults to `todayIso()` (UTC-anchored); note optional, `max(500)` in the schema
- [x] `create` is optimistic — inserts the row, rolls back + toasts on failure
- [x] Every write invalidates `["group", groupId]` — one broad key covering balances **and** the
      settlements list (TanStack prefix matching)
- [x] `SettlementList` renders the history newest-first; each row has Editar (reopens the dialog
      in edit mode) and Eliminar (confirm dialog naming the payment) — any member, like expenses
- [x] Tests (5 files, 17 cases): prefill from an edge; over-payment submits the larger amount and
      the refetched balances flip the sign; optimistic row appears then rolls back with a toast on
      failure; history render + edit/delete controls; schema accepts any positive / rejects zero

## Files touched

`_components/`: `SettleUpDialog`, `SettlementForm`, `SettlementList`, `SettlementRow`,
`PaymentPlanSection` (extracted from `CurrencyBalanceBlock` for the per-edge control),
`useSettlements`, `settlementFormSchema`, `settlementTypes`, `settlementsTestHelpers`; edits to
`BalancesTab`, `CurrencyBalanceBlock`, `balances/page.tsx`, `balancesTestHelpers`, `i18n/es.ts`.
More files than the two the task sketched — the 100-line component limit forces the split.

## Out of scope

Moving actual money. Cuadre records that a payment happened and never touches a payment rail.

## Files likely touched

```
src/app/g/[groupId]/_components/settle-up-dialog.tsx
src/app/g/[groupId]/_components/settlement-list.tsx
```
