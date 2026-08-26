---
id: T054
title: Conversion on the balance read path
epic: E6-currency
status: done
depends_on: [T053, T044]
size: M
---

## Context

Where pinned rates actually change what a member sees. The rule that makes this work for every
split strategy — including `exact`, where there is no strategy to re-run — is to convert the
expense **total** and then re-apportion by the original amounts as weights.

Read [splitting.md](../../docs/context/splitting.md) § 6 and
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md) § *How conversion actually works*.

## Acceptance criteria

- [x] When a group has a `display_currency`, every expense not already in it is converted:
      ```
      converted_total  = convert(expense.total, pinned_rate)
      converted_splits = apportion(converted_total, weights = original split amounts)
      converted_payers = apportion(converted_total, weights = original payer amounts)
      ```
- [x] **Never convert a net balance directly**, and never convert each split row independently —
      three independently converted rows routinely miss their converted total by a unit, and that
      unit is an unbalanced expense
- [x] Re-apportionment uses the **same seed** (the expense id) as the original split, so the
      remainder lands consistently
- [x] Settlements convert as a single amount — nothing to apportion
- [x] `Σ splits == total` holds **after** conversion, for every strategy including `exact`
- [x] `Σ net == 0` still asserted, now in the display currency
- [x] `GET /api/groups/:id/balances` returns exactly one `byCurrency` entry when a display currency
      is set, carrying the pin metadata (`asOf`, `source`) so the UI can label it
- [x] The expense feed reports converted amounts **and** the original, so the UI can show both
- [x] Enable the `convert preserves Σ splits == total` property in
      [T032](T032-property-invariants.md)'s harness
- [x] Tests: a mixed COP/USD group converts to one entry summing to zero; an `exact` split
      re-apportions and still balances; clearing the display currency returns identical numbers to
      before it was set; converting and re-clearing repeatedly is stable

## Out of scope

The UI (T066, T068). Per-member display currency — explicitly rejected for v1.

## Files likely touched

```
src/server/services/balances.ts
src/lib/money/convert.ts
src/app/api/groups/[id]/balances/route.ts
```

## Implementation notes

**Touched `src/server/services/expenses.ts` and `src/server/services/fx.ts`, neither listed
above.** The acceptance criteria explicitly require the expense feed to show converted amounts —
that's `listExpenses`/`getExpense`, not the balances endpoint — so there was no way to satisfy this
task without them. `route.ts` for balances needed **no changes at all**: it already returns
whatever the service returns, so the new `pins` field on a `byCurrency` entry and the new
`converted` field on an expense flow through for free.

**The conversion primitives live in two places, split by what they need.** `convertExpenseAmounts`
(the pure total-then-reapportion math: `lib/money/convert.ts`) takes only bigints and a seed — no
I/O, fully property-testable. `convertAmounts`/`convertSettlementAmount`/`loadConversionContext`
(`services/fx.ts`) are the DB-backed layer around it: one query for the group's pins (filtered to
`to_currency = display_currency`) and one for every currency's exponent, fetched **once per
request**, not once per expense — the same "no N+1" discipline as everywhere else in this
codebase. `balances.ts` and `expenses.ts` both consume this from `fx.ts` rather than duplicating
the "look up a rate, throw if missing" logic twice.

**A converted total that rounds all the way to zero drops every payer and split, instead of
throwing.** `apportion()` requires a positive total by construction, and a foreign-currency expense
small enough to vanish under conversion (e.g. 1 COP centavo into USD) is a real, if rare, case the
`fc.bigInt`-driven property test surfaces on its own once the rate is allowed to get small enough.
Resolved the same way `apportionPositive` already treats a zero *share* — dropped, not an error —
documented at length on `convertExpenseAmounts` itself.

**Payers get a converted seed distinct from splits.** Splits reuse the expense id exactly, per the
acceptance criteria, so the same member absorbs the remainder whether the amounts on screen are
original or converted. Payer amounts were never apportioned in the first place (creation takes them
as given from `paidBy`), so there's no prior seed to stay consistent with — payers get their own
derived seed (`${id}-converted-payers`), just needs to be deterministic per expense, which it is.

**Judgment call: a currency present in the ledger with no matching pin is `RATE_UNAVAILABLE`, on
both the balances and expenses read paths, not a silent pass-through or a partial response.** This
happens when a member adds an expense in a new currency after the group already set a display
currency — pinning is a snapshot at `PUT` time (T053), so the read path has no rate for it. Chose
consistency with the `PUT` endpoint's own error over a softer per-row fallback: a feed where some
rows mysteriously have `converted: null` and others don't, with no explanation, seemed worse than a
clear 422 naming the missing pair.

**Judgment call: the balances response's `pins` field carries the full list of pins actually used**
(one per source currency converted this response), not a single rate — a group with three original
currencies converting to a fourth can have three different `asOf`/`source` values if they were
pinned at different times, and picking just one would be misleading.

**`loadPairwiseLedger` now also returns each expense's id** (`PairwiseLedgerWithIds`, a strict
superset of `PairwiseLedger`) — needed as the re-apportionment seed, but `computePairwise` still
only ever sees it through the narrower type it already declares, so nothing downstream changed.

**The property test's `convertExpense` stub used a `rateBp` (basis-points-shaped) placeholder
signature** from before T050 established the actual scaled-bigint rate convention. Adapted it to
the real `convertExpenseAmounts` signature — same pattern T041/T042 used for their own stubs — and
widened the generated rate range to `1n..10^15n` (mirroring `genTotal`'s own "spans tiny to huge on
purpose" comment), specifically so the zero-conversion edge case above gets exercised by the
property harness, not just the hand-written unit test. Also extended the enabled property to assert
`Σ payers == total` alongside `Σ splits == total`, since T054 apportions both.

Verified `convertExpenseAmounts` against hand-computed examples in a throwaway script before
writing it into the test suite, including the exponent-asymmetry and zero-rounding cases, per this
session's standing "verify against reality before trusting" discipline. All new/modified code in
`lib/money/convert.ts`, `services/fx.ts`, and `services/balances.ts` reached 100% coverage; the two
lines still uncovered in `services/expenses.ts` (a non-`Error` rethrow in `resolveSplit`, a
malformed-cursor `catch`) predate this task and are unrelated to it.
