---
id: T050
title: fx_rates schema and scaled-integer rate parsing
epic: E6-currency
status: todo
depends_on: [T020]
size: S
---

## Context

Where rates live, and the parsing step that keeps them exact. The parsing matters more than the
table: a `parseFloat` in this path produces numbers that look right and are wrong in the last
digits, which then get pinned into a group and quietly stay wrong.

Read [currency.md](../../docs/context/currency.md) § *Storing rates* and
[data-model.md](../../docs/context/data-model.md) § *fx_rates*.

## Acceptance criteria

- [ ] `fx_rates`: `base_currency`, `quote_currency`, `rate numeric(20,10)`, `as_of date`, `source`,
      `fetched_at`, unique `(base_currency, quote_currency, as_of, source)`
- [ ] **Append-only.** Never overwrite a past day's rate — a pinned group references it. Enforce it
      in the service and say so in the migration
- [ ] `rate` is read as a **string** and shifted to a `bigint` scaled by `10^10` by digit
      manipulation. **Not** `parseFloat(x) * 1e10`
- [ ] `convertMinorUnits(amount, rateScaled, expSource, expTarget)` implementing
      [currency.md](../../docs/context/currency.md)'s formula with **half-up** rounding, in `bigint`
      arithmetic throughout
- [ ] The exponent term `10^(exp_target − exp_source)` is implemented properly even though it is
      currently always 1 — the first exponent-0 currency (JPY, CLP) breaks anything that took the
      shortcut
- [ ] Cross-rate derivation: `COP→EUR = (USD→EUR) / (USD→COP)`, computed at the scaled-integer
      level with a documented rounding point
- [ ] Tests: the worked example from [currency.md](../../docs/context/currency.md) —
      `2000n` USD at `3042.806266` yields exactly `6085613n` COP; a rate string with trailing zeros
      parses identically to one without; a mismatched-exponent conversion is correct

## Out of scope

Fetching rates (T051). The refresh job (T052). Pins (T053).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/lib/money/convert.ts
src/lib/money/convert.test.ts
```
