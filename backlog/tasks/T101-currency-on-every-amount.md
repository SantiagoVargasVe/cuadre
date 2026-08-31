---
id: T101
title: Name the currency on every amount — COP and USD both render as "$"
epic: E12-first-use
status: todo
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

- [ ] COP, USD and EUR are **visually distinguishable** wherever an amount is rendered. Decide
      the rule deliberately (e.g. `currencyDisplay: "code"`, or a `US$` / `$` split, or a code
      suffix) and **write down why in design-system.md**, next to the existing `narrowSymbol`
      note — which must be corrected, since it currently implies `narrowSymbol` was the right
      answer for every currency
- [ ] The fix lives in **`src/lib/money/format.ts`**, the one place allowed to call `Intl`.
      No component starts appending a currency code of its own
- [ ] The existing guarantees still hold: **COP shows no decimals**, EUR never renders as the
      literal `EUR`, amounts stay `tabular-nums`, and the `bigint` path is untouched — no amount
      is ever converted to `Number`
- [ ] Applies everywhere `<Money>` is used: the expense feed and row, the expense detail, the
      balances rows, the payment plan, the settlement list, and the groups list
- [ ] The per-currency balance block headings stay — this does not replace them, and **nothing
      starts summing across currencies**
- [ ] Tests in `format.test.ts` assert the three currencies produce three **distinct** strings,
      including the specific case that regressed here: the same numeric amount in COP and in USD
      must not format identically. `src/lib/money/**` is gated at 95% — keep it green
- [ ] Checked at 375px: the longer strings must not wrap or break the row layout

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
