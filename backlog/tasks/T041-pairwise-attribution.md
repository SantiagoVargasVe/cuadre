---
id: T041
title: Pairwise attribution — the raw, un-simplified view
epic: E5-balances
status: done
depends_on: [T040]
size: M
---

## Context

What the group sees with simplify **off**: who owes whom, mirroring what actually happened. It is
also what a simplified edge is explained in terms of, so it has to keep working even while
simplification is on — which is one of the reasons neither view can be the stored one.

Read [splitting.md](../../docs/context/splitting.md) § 4.1.

## Acceptance criteria

- [x] Within one expense, member `s` owes payer `p` a share of `s`'s split **proportional to what
      `p` put in**: `apportion(split_s, weights = [paid_p for each payer])`, using the same
      remainder rule as everywhere else
- [x] Netted across all expenses and settlements per ordered pair; pairs netting to zero are dropped
- [x] A member never owes themselves — self-edges are eliminated, not rendered as zero
- [x] **`Σ pairwise(m) == net(m)` for every member.** This identity is what ties the two views
      together; it holds by construction and must be tested, not assumed
- [x] Enable the `Σ pairwise(m) == net(m)` property in
      [T032](T032-property-invariants.md)'s harness
- [x] Deterministic ordering of the output, so the UI doesn't reshuffle between renders
- [x] Tests: single payer, single split — the trivial case; multi-payer attribution splits
      proportionally and sums back to each payer's contribution; the identity holds on a ledger
      with several expenses and a settlement

## Implementation notes

The naive reading of the first bullet — call `apportion(split_s, payers)` independently for each
split member `s` — does **not** satisfy the identity bullet in general. It preserves each row's
sum (by `apportion()`'s own guarantee) but not each column's: two rows can round their leftover
unit onto the same payer, or onto neither of the payers who needed it, and the errors don't
cancel out by member. Caught by the property test, not by the hand-written unit tests, which is
exactly why the acceptance criteria call out the property explicitly.

A second attempt — floor every cell, then hand out leftover units to whichever row/column pair
still needed one, in largest-remainder order — also failed the property test. That approach
implicitly assumed no row or column ever needed more than one leftover unit, which only holds
with two rows or two columns; with three or more payers a single row can need up to
`payerCount - 1` extra units, turning it into a genuine bipartite transportation problem that a
single sorted-list pass doesn't solve.

The implementation that passes (3000+ random ledgers, plus the full 300-run property suite) is a
2D cumulative-sum "corner difference": order split members and payers, take running totals of
each, and derive every cell as a discrete second difference of `floor(rowRunningTotal *
colRunningTotal / total)`. Both margins fall out of the algebra (the terms telescope exactly) —
see the doc comment on `attributeExpense` in `pairwise.ts` for the derivation.

**Also discovered along the way, fixed in the same PR:** `apportion()` can legitimately resolve a
member's share to `0` when a total is small relative to the member count — correct for
`apportion()` itself, but `equal`/`shares`/`percentage` (T031/T034) were passing that zero
straight through to a `CHECK(amount > 0)` column, which would have 500'd on a real tiny-total
expense. Fixed with a new `apportionPositive()` wrapper that drops zero-amount members instead of
persisting them.

## Out of scope

Simplification (T042). Rendering (T066).

## Files likely touched

```
src/lib/money/pairwise.ts
src/lib/money/pairwise.test.ts
```
