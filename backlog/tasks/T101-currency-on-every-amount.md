---
id: T101
title: Name the currency on every amount — COP and USD both render as "$"
epic: E12-first-use
status: done
depends_on: []
size: S
---

## Context

In a group with mixed-currency expenses, the feed gives no way to tell which currency a row is
in. An Uber for 100.000 COP and a dinner for 80 USD sit next to each other and the reader has to
guess.

**This is worse than a missing label.** Measured, under this app's locale:

```js
// es-CO, currencyDisplay: "narrowSymbol", the exact options formatMoney uses
COP → "$ 80"
USD → "$ 80"     // identical
EUR → "€ 80"
```

`narrowSymbol` was chosen to fix the `EUR` gotcha (`es-CO` renders it as the literal string
`EUR` under `symbol`), and it does — but it also collapses COP and USD onto the same `$`. So the
app currently renders two different amounts of two different currencies as the same string. In
an app whose entire output is who owes whom, that is a trust bug of the same family as a wrong
number.

This bites hardest when the group has **no display currency set**, which is the default: balances
arrive as one block per currency and the feed interleaves them. With a display currency set,
everything is already in one currency and `<Money converted>` marks it.

Read [design-system.md](../../docs/frontend/design-system.md) § *Money display* and
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Money*.

## Acceptance criteria

- [x] COP, USD and EUR are **visually distinguishable** wherever an amount is rendered. The rule:
      per-currency `currencyDisplay` — `symbol` for COP (`$`) and USD (`US$`), `narrowSymbol`
      for EUR (`€`). Chose the `$` / `US$` split over `currencyDisplay: "code"` so amounts keep
      a glyph for quick scanning, EUR keeps `€` rather than the literal `EUR` (an explicit
      guarantee below), and it matches the `$` / `US$` wording T104 already assumes. Written up
      in design-system.md § *Money display*; the stale "narrowSymbol for every currency" note is
      corrected there and in frontend/CLAUDE.md § *Money*
- [x] The fix lives in **`src/lib/money/format.ts`** (`CURRENCY_META[c].currencyDisplay`). No
      component appends a code — and `GroupCard`'s pre-existing `{entry.currency}` workaround,
      which did exactly that, is removed now that `<Money>` names the currency itself
- [x] The existing guarantees still hold: COP shows no decimals, EUR renders `€ 45,00` (never
      the literal `EUR` — asserted), amounts stay `tabular-nums`, the `bigint` split→`Intl`
      path is byte-for-byte unchanged — no amount becomes a `Number`
- [x] Applies everywhere `<Money>` is used — the change is entirely inside `formatMoney`, so the
      feed, row, detail, balance rows, payment plan, settlement list and groups list all get it
- [x] The per-currency balance block headings are untouched (`BalancesTab` still renders a
      `heading` per currency); nothing sums across currencies
- [x] `format.test.ts`: new case asserts COP/USD/EUR produce three distinct strings and that the
      **same** amount in COP vs USD does not format identically; USD/negative-USD expectations
      updated to `US$`. `src/lib/money/**` coverage stays green (no new branches)
- [x] Checked at 375px in both themes — `US$` does not wrap or break `tabular-nums` alignment;
      screenshots in the PR

## Out of scope

Converting anything. This is display only — no expense is rewritten and no rate is fetched
([ADR-0007](../../docs/adr/0007-reversible-display-currency.md)). The display-currency switcher's
copy is [T105](T105-display-currency-copy.md).

## Files likely touched

```
src/lib/money/format.ts
src/lib/money/format.test.ts
src/app/_ui/Money.tsx
docs/frontend/design-system.md
```
