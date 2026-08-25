# ADR-0004 — Money is an integer count of minor units

**Status:** Accepted · 2026-08-25

## Context

This app's entire output is arithmetic on money. Every balance, every split, every simplified
payment plan is derived — nothing a user reads is a number they typed. A representation that
loses a unit somewhere produces a plan that doesn't settle, and the group discovers it at the end
of a trip when they're trying to close the books.

The options were IEEE floats (never), `numeric(14,2)` as the sibling wishlist app uses, or
integer minor units.

## Decision

```ts
type Money = { amount: bigint; currency: CurrencyCode };
```

`bigint` minor units, paired with an ISO-4217 code. Stored as `bigint` + a `currency` FK. Crossing
the wire as a **string** of minor units, because JSON numbers are doubles.

`numeric` survives in exactly two places — `fx_rates.rate` and `group_fx_pins.rate` — because
those are rates, not money, and they are read as strings and shifted to scaled integers before any
arithmetic.

## Why not `numeric(14,2)`, which worked fine next door

The wishlist app stores a price, displays it, and never computes with it. Cuadre divides one
number among seven people and must land back on the original to the unit.

`numeric` would survive that — Postgres computes it exactly — but the values do not stay in
Postgres. They come into JavaScript, where `numeric` arrives as a string and every operation on it
is either a string-parse to `Number` (floating point, silently) or a decimal library. The
representation stops being authoritative at the boundary, which is exactly where the arithmetic
happens.

Integers don't have a boundary problem. `bigint` is exact in JavaScript, exact in Postgres, and
exact in JSON as long as it's a string.

## The COP wrinkle

ISO 4217 assigns COP a minor unit of **2**, and Colombians never write centavos. The app stores
exponent 2 and *displays* 0 decimals.

Storing exponent 0 was considered and rejected: converting `20.00 USD` at `3042.806266` lands on
`60.856,13 COP`, and discarding those centavos at write time makes every conversion lossy and
every round-trip asymmetric. The precision costs nothing to keep and the display rule is one line
in the formatter.

> Verified: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` renders
> `$ 150.000,00`. CLDR gives COP two fraction digits, so `maximumFractionDigits: 0` must be passed
> explicitly. This surprises everyone once.

## Why no money library

`dinero.js` or `decimal.js` would add a dependency to avoid code that has to be read and tested
line by line regardless. The arithmetic here is addition, comparison, and one integer division
with an explicit remainder rule — all specified in
[splitting.md](../context/splitting.md) §3.1. A library would not make the apportionment rule,
which is the actually hard part, any less ours to get right.

## Consequences

- Every money column is `bigint`. Every money value in code carries its currency alongside it;
  a bare number is not a money value and should not typecheck as one.
- Parsing from the wire needs an explicit digits-only check. `BigInt("1e9")` throws, but a stray
  `Number` coercion elsewhere won't, and a silently truncated amount is unrecoverable.
- Money assertions in tests compare `bigint`s, never formatted strings.
- Adding an exponent-0 currency (JPY, CLP) will break any code that assumed both sides of a
  conversion share an exponent. The general formula is written down in
  [currency.md](../context/currency.md); use it rather than the shortcut, even while the shortcut
  is correct for COP/USD/EUR.
