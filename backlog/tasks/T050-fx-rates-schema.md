---
id: T050
title: fx_rates schema and scaled-integer rate parsing
epic: E6-currency
status: done
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

- [x] `fx_rates`: `base_currency`, `quote_currency`, `rate numeric(20,10)`, `as_of date`, `source`,
      `fetched_at`, unique `(base_currency, quote_currency, as_of, source)`
- [x] **Append-only.** Never overwrite a past day's rate — a pinned group references it. Enforce it
      in the service and say so in the migration
- [x] `rate` is read as a **string** and shifted to a `bigint` scaled by `10^10` by digit
      manipulation. **Not** `parseFloat(x) * 1e10`
- [x] `convertMinorUnits(amount, rateScaled, expSource, expTarget)` implementing
      [currency.md](../../docs/context/currency.md)'s formula with **half-up** rounding, in `bigint`
      arithmetic throughout
- [x] The exponent term `10^(exp_target − exp_source)` is implemented properly even though it is
      currently always 1 — the first exponent-0 currency (JPY, CLP) breaks anything that took the
      shortcut
- [x] Cross-rate derivation: `COP→EUR = (USD→EUR) / (USD→COP)`, computed at the scaled-integer
      level with a documented rounding point
- [x] Tests: the worked example from [currency.md](../../docs/context/currency.md) —
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

## Implementation notes

`fx_rates` has no surrogate `id`: the natural key is exactly the uniqueness constraint the
acceptance criteria asks for, and nothing references a row by id — `group_fx_pins` (T053) stores
its own copy of the rate directly rather than a foreign key here, per currency.md. The composite
`(base_currency, quote_currency, as_of, source)` is the primary key.

"Enforce it in the service and say so in the migration" splits across two tasks: there's no
service here yet (T051/T052 are the ones that actually write rows, and out of scope for this
task), so the append-only guarantee is currently just the migration's own `COMMENT ON TABLE`
stating the invariant — not a DB trigger, since the acceptance criteria's own phrasing puts
enforcement at the service layer, not the database's.

The exponent handling generalizes `10^(expTarget − expSource)` by folding it into the numerator
when non-negative and into the denominator when negative (`10n ** BigInt(negative)` isn't
representable) — verified both directions explicitly (exp2→exp0 and exp0→exp2) since the
same-exponent case (all three currently-supported currencies) can't exercise this branch at all.

Cross-rate derivation's rounding point: half-up via the same `+ denominator/2` integer trick as
`convertMinorUnits`, documented in the function's own comment that this holds regardless of
whether the fetched rate happens to scale to an odd integer (the "exactly half" case the formula
rounds up from literally can't occur against an odd denominator, since a numerator can never land
on exactly half of an odd integer). Verified the cross-rate value's magnitude two ways — computed
by the function, and independently via converting the same COP amount through USD as an
intermediate currency — landing within a single unit of each other, which is the expected
rounding-error bound for one extra derivation step.
