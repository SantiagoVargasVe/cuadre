---
id: T053
title: Display currency and pinned rates
epic: E6-currency
status: done
depends_on: [T052, T022]
size: M
---

## Context

The "convert everything to one currency" action — implemented as a reversible display setting plus
a rate snapshot, so it never rewrites an expense. This is the decision that keeps the one
irreversible-looking action in the product from actually being irreversible.

Read [ADR-0007](../../docs/adr/0007-reversible-display-currency.md) in full and
[currency.md](../../docs/context/currency.md) § *Display currency*.

## Acceptance criteria

- [x] `group_fx_pins`: pk `(group_id, from_currency, to_currency)`, `rate numeric(20,10)`,
      `as_of`, `source`, `pinned_at`, `pinned_by`
- [x] `PUT /api/groups/:id/display-currency { currency }` → sets `groups.display_currency` and
      writes **one pin per currency present in the group**, in one transaction
- [x] Pins store the **derived cross rates** directly, so read-time conversion is one
      multiplication and never re-derives. Changing `FX_BASE_CURRENCY` later must not move an
      already-pinned group
- [x] **No expense row is written, updated, or read-modified.** If this handler touches `expenses`,
      it contradicts the ADR
- [x] The response returns the pins — rate, `asOf`, `source` — because the UI has to show what it
      converted at
- [x] `DELETE` clears `display_currency` and **keeps the pin rows**, so re-enabling reproduces the
      same numbers and the group keeps a record of what it converted at and when
- [x] Re-`PUT`ting the same currency **re-pins at today's rates**. That is the only thing that
      moves an already-converted group's numbers, and it is always an explicit member action
- [x] **Nothing else may ever update a pin** — no job, no cache expiry, no staleness heuristic.
      Write that as a comment at the table definition and at the service
- [x] A rate older than 7 days is refused for a **new** pin (`RATE_TOO_STALE`). Already-pinned
      groups are unaffected
- [x] `RATE_UNAVAILABLE` when a needed pair can't be resolved even after the lazy fetch
- [x] Tests: pinning writes one row per present currency; **inserting newer `fx_rates` rows does
      not change an existing pin's output** — the central test of this task; `DELETE` then `PUT`
      the same currency reproduces the original numbers from the retained pins; a stale rate is
      refused for a new pin but not for an existing one

## Out of scope

Applying pins on the read path (T054). The currency switcher UI (T068).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/app/api/groups/[id]/display-currency/route.ts
src/server/services/fx.ts
```

## Implementation notes

**Cross-rate derivation always pivots through `FX_BASE_CURRENCY`**, matching currency.md's own
`COP→EUR = (USD→EUR) / (USD→COP)` formula: for each present currency, this fetches (or reuses)
the `USD→present` and `USD→display` legs and derives `present→display` via T050's
`deriveCrossRateScaled`. When either leg *is* `FX_BASE_CURRENCY` itself, its "rate" is the
identity `10^RATE_SCALE` synthesized in code — there's no `fx_rates` row for a currency against
itself, by design (T052 already skips writing that self-pair).

**Rate resolution for a pin tries the lazy fetch first, then falls back to whatever's already
stored — but only within 7 days.** A `PUT` is a deliberate, explicit action, so it doesn't settle
for a stretched-thin rate silently: `usdRateForPin()` calls `ensureRate()` (T052, always "today"
on success); only if that fails does it check the most recent stored row's age, refusing with
`RateTooStaleError` past 7 days, or `RateUnavailableError` if nothing is stored at all. In
practice, with the provider reachable, this resolves transparently every time — the staleness
path only matters when the provider is actually down.

**Added `formatRateScaled()` to `lib/money/convert.ts`** — the missing inverse of T050's
`parseRateScaled()`, needed to turn a derived scaled `bigint` back into a `numeric(20,10)`-
compatible string for the pin row. Digit-splitting again, not `Number`-based formatting, for the
same reason the parse direction avoids it.

**"One transaction" covers the two writes, not the rate-fetching that precedes them.** All the
(potentially slow, network-bound) rate resolution happens before `withTransaction` opens; the
transaction itself is just updating `groups.display_currency` and upserting the pin rows —
holding a DB transaction open across an external HTTP call felt like the wrong tradeoff even
though the acceptance criteria's wording would technically permit it.

**Re-`PUT` uses `onConflictDoUpdate`, the one and only legitimate `UPDATE` on this table** —
explicit, member-triggered, never automatic. Verified directly (a stale row inserted by hand
gets overwritten, staying at one row per pair) rather than only inferring it from the "insert new
group" happy path, since that path can't tell an overwrite from a fresh insert.

Verified the full `PUT`/`GET`/`DELETE` flow against the real provider and a real database with a
throwaway script before writing the mocked test suite — including confirming pins really do
survive a `DELETE` and reproduce identical numbers on re-`PUT`.
