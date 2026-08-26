---
id: T030
title: Money primitives — bigint minor units, parsing, wire format
epic: E4-money
status: done
depends_on: [T003]
size: S
---

## Context

The type every other money task builds on. It is deliberately tiny, pure, and paranoid: this is
the boundary where a string from the network becomes a number the app does arithmetic with, and
the failure mode of getting it wrong is a silently truncated amount, which is unrecoverable.

Read [splitting.md](../../docs/context/splitting.md) § 1 and
[ADR-0004](../../docs/adr/0004-money-as-integer-minor-units.md).

## Acceptance criteria

- [x] `type Money = { amount: bigint; currency: CurrencyCode }`
- [x] `src/lib/money/` **imports nothing** — no Drizzle, no Next, no config, no I/O. It is pure so
      it can be tested exhaustively, and services call in while it never calls out
- [x] `parseMinorUnits(s: string): bigint` with an **explicit digits-only check**. `"1e9"`,
      `" 12 "`, `"12.5"`, `"-5"`, and `""` are all rejected with a typed error. `BigInt()` alone is
      not sufficient — it accepts things you don't want and rejects things confusingly
- [x] `toWire(m: Money)` → `{ amount: string, currency }`. Never a JSON number: COP minor units
      pass `Number.MAX_SAFE_INTEGER` sooner than feels comfortable
- [x] Adding or comparing two `Money` values of **different currencies throws.** There is no
      implicit conversion anywhere in this module
- [x] `assertPositive` — all amounts in this app are strictly positive; a refund is a settlement in
      the opposite direction, not a negative expense
- [x] Currency metadata (exponent, display decimals) is read from the `currencies` table by the
      caller and passed in. **This module does not know COP is special** — that knowledge lives in
      the database and the formatter
- [x] Tests: every rejection case above; round-trip `toWire`/`parse`; the cross-currency throw;
      a COP amount past `Number.MAX_SAFE_INTEGER` surviving a round trip intact

## Out of scope

Formatting for display (T061). Apportionment (T031). Conversion (T054).

## Files likely touched

```
src/lib/money/{types,parse,wire}.ts
src/lib/money/*.test.ts
```
