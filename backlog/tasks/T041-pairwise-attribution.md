---
id: T041
title: Pairwise attribution — the raw, un-simplified view
epic: E5-balances
status: todo
depends_on: [T040]
size: M
---

## Context

What the group sees with simplify **off**: who owes whom, mirroring what actually happened. It is
also what a simplified edge is explained in terms of, so it has to keep working even while
simplification is on — which is one of the reasons neither view can be the stored one.

Read [splitting.md](../../docs/context/splitting.md) § 4.1.

## Acceptance criteria

- [ ] Within one expense, member `s` owes payer `p` a share of `s`'s split **proportional to what
      `p` put in**: `apportion(split_s, weights = [paid_p for each payer])`, using the same
      remainder rule as everywhere else
- [ ] Netted across all expenses and settlements per ordered pair; pairs netting to zero are dropped
- [ ] A member never owes themselves — self-edges are eliminated, not rendered as zero
- [ ] **`Σ pairwise(m) == net(m)` for every member.** This identity is what ties the two views
      together; it holds by construction and must be tested, not assumed
- [ ] Enable the `Σ pairwise(m) == net(m)` property in
      [T032](T032-property-invariants.md)'s harness
- [ ] Deterministic ordering of the output, so the UI doesn't reshuffle between renders
- [ ] Tests: single payer, single split — the trivial case; multi-payer attribution splits
      proportionally and sums back to each payer's contribution; the identity holds on a ledger
      with several expenses and a settlement

## Out of scope

Simplification (T042). Rendering (T066).

## Files likely touched

```
src/lib/money/pairwise.ts
src/lib/money/pairwise.test.ts
```
