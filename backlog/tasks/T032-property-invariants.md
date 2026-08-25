---
id: T032
title: Property-based invariant harness
epic: E4-money
status: todo
depends_on: [T031]
size: M
---

## Context

The unit tests in T031 check cases somebody thought of. This checks the invariants that must hold
for **every** ledger — and it is the single highest-value test suite in the repo, because the bugs
that survive in money code are the ones nobody imagined a case for.

It lands here, early, rather than at the end of E5: every subsequent money task extends it, and a
harness that arrives after the code it was meant to constrain constrains nothing.

Read [testing.md](../../docs/context/testing.md) § *Property-based tests* and
[splitting.md](../../docs/context/splitting.md) § 8.

## Acceptance criteria

- [ ] A generator producing random valid ledgers: 2–15 members, random expenses with random
      strategies, random payer counts (1..n), random totals across a wide magnitude range, random
      currencies, random settlements
- [ ] Totals in the generator span from `1n` to well past `Number.MAX_SAFE_INTEGER` — the
      small-total cases are where apportionment breaks and the large ones are where a stray
      `Number` coercion shows up
- [ ] Properties asserted, per [splitting.md](../../docs/context/splitting.md) § 8:
      - `Σ splits == total` for every expense
      - `Σ payers == total` for every expense
      - `Σ net over members == 0` for every currency
      - `Σ pairwise(m) == net(m)` for every member
      - `simplify(b)` preserves every net position in `b`
      - `|simplify(b)| ≤ n − 1`
      - conversion preserves `Σ splits == total`
- [ ] Properties for balances, pairwise, simplification and conversion are written now and marked
      pending; **T040, T041, T042 and T054 each enable theirs as part of their own acceptance
      criteria.** A pending property is a contract, not a TODO
- [ ] Failures print the generating seed so a run is reproducible. A property failure nobody can
      re-run is a property failure nobody fixes
- [ ] Runs in CI within a sane time budget — tune the case count, don't delete properties
- [ ] `src/lib/money/**` coverage gate at 95% is enforced and passing

## Out of scope

Implementing balances, pairwise, or simplification — this task writes the properties they must
satisfy.

## Files likely touched

```
src/lib/money/__tests__/properties.test.ts
src/lib/money/__tests__/generators.ts
vitest.config.ts
```
