---
id: T104
title: Settle up in any of the group's currencies, with the conversion spelled out
epic: E12-first-use
status: done
depends_on: [T103]
size: L
---

## Context

Recording a payment in a mixed-currency group is awkward today. The settle-up form has **no
currency field** — the currency is decided by *which button you pressed*: the one in the Balances
header uses the group's `defaultCurrency`, and each per-edge "Registrar pago" uses that balance
block's currency. So to record a USD payment you have to know to scroll down to the USD block
first. Nothing on screen says so.

And even once you're in the right form, the number you need isn't there. Bank transfers happen in
COP; the debt says `US$ 40`. Nothing tells you what to actually wire.

**The invariant this task has to protect.** A settlement is a plain ledger entry in the currency
it was recorded in — `from → to`, one amount, one currency, one date
([ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md)), converted on *read* like
everything else ([ADR-0007](../../docs/adr/0007-reversible-display-currency.md), and
`convertSettlementAmount` in `services/fx.ts`). So:

> **Recording a COP settlement does not reduce a USD debt.** It moves the COP net and leaves the
> USD net exactly where it was.

That makes the obvious-looking design — "let me pay this USD debt in COP" — the wrong one unless
handled deliberately. The steer: **the row records the currency of the debt being settled, and
the helper text tells you how much COP to wire.** The transfer is a real-world fact about a bank;
the ledger entry is a fact about the debt. If the task lands on the other answer instead, that is
a product decision and it must be written down, with the UI making it unmistakable that the USD
balance is still open.

Read [ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md),
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md), and
[currency.md](../../docs/context/currency.md) § *Storing rates*.

## Acceptance criteria

- [x] The form has a **currency select** (`SettlementAmountFields`), defaulting to the currency
      the dialog was opened from — the plan edge's block, the settlement's own currency when
      editing, or the group default for the standalone button. `SettleUpDialog` passes it as the
      initial value, no longer a fixed prop
- [x] The select offers `presentCurrencies` — the group default plus any currency with live
      activity (`BalancesTab` derives it from `data.byCurrency`), unioned with the opened
      currency. Never every supported code
- [x] `<MoneyField currency={watch("currency")}>` re-formats live; on a currency switch an effect
      re-runs `formatAmountInput` so "40,50" typed as USD becomes "40" under COP. `parseAmountInput`
      already splits on the decimal separator, not the grouping dot, so there is no ×100 reinterpret
      in either direction — asserted
- [x] **Helper text** (`TransferHint`) whenever the selected currency isn't COP: "Para pagar
      US$ 40,00 necesitas transferir $ 160.000 · tasa de <source>, <date>". Updates live with the
      amount and currency
- [x] The rate line always carries `source` + `asOf` (`t.rateProvenance`), never a bare number
- [x] **No arbitrary-pair quote existed** (checked the full route list — only `GET
      /display-currency`, pins-only). Added `GET /api/groups/:id/fx-quote?from=&to=` →
      `{ rate, asOf, source }`, member-only (`requireMembership` in `quoteRate`), documented in
      api-contract.md
- [x] **Never writes a pin** — `quoteRate` derives the cross rate from the two USD legs via
      `ensureRate` and returns it; a service test asserts `group_fx_pins` stays empty and
      `display_currency` stays null after a quote
- [x] A missing rate → `RATE_UNAVAILABLE` naming the requested `from`/`to`; `TransferHint` renders
      `null` on the query error rather than a stale number — asserted
- [x] Lazy fetch still applies — `quoteRate` calls `ensureRate`, which fetches on a missing day;
      asserted
- [x] `bigint` boundary intact — the form's `amount` is a string until `toCreateInput`
      (`parseAmountInput` → minor-unit string); `TransferHint` converts with `convertMinorUnits`
      on `bigint`s. Nothing sees a `Number`
- [x] Plan-edge prefill unchanged — still `{ toUserId, amountMinor }` with no link back; the only
      addition is prefilling `currency` from the same context
- [x] Over/under-payment unchanged — the schema's only amount rule is still "> 0"
- [x] Tests: `SettlementForm.test.tsx` (select changes submitted `currency`; switch re-formats
      not ×100), `SettlementForm.transferHint.test.tsx` (converted amount + source/date;
      `RATE_UNAVAILABLE` hides it; no fetch when COP), `fx-quote.test.ts` + `route.test.ts`
      (cross rate, no pin, lazy fetch, non-member, unsupported), `balances.test.ts` (a COP
      settlement leaves the USD net untouched)

## Out of scope

Moving actual money — Cuadre records that a payment happened and never touches a payment rail.
Per-member display currency, explicitly rejected for v1
([roadmap.md](../../docs/roadmap.md) § E11). Changing how balances are computed.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/SettlementForm.tsx
src/app/(app)/g/[groupId]/_components/SettleUpDialog.tsx
src/app/(app)/g/[groupId]/_components/settlementFormSchema.ts
src/app/api/groups/[id]/...            (the rate quote)
src/server/services/fx.ts
src/lib/i18n/es.ts
docs/context/api-contract.md
```
