---
id: T031
title: Apportionment and the six split strategies
epic: E4-money
status: done
depends_on: [T030]
size: L
---

## Context

**The most important function in this codebase.** Every split, every conversion, and every
pairwise attribution goes through one apportionment routine. A bug here produces numbers that look
completely reasonable and don't add up, discovered at the end of a trip when six people are trying
to close the books.

Read [splitting.md](../../docs/context/splitting.md) § 3 in full — it specifies the rule to the
minor unit, including the worked examples. Do not implement from this task file alone.

## Acceptance criteria

- [x] `apportion(total: bigint, weights: Map<Id, bigint>, seed: string): Map<Id, bigint>`
- [x] Exact: `Σ output == total`, always, for every input. This is not a tolerance
- [x] **Largest remainder method** — floor each share, then distribute the leftover units to the
      largest fractional remainders. Remainders are compared as exact integers, never as floats
- [x] **Ties break by rotation, not by member id.** With an `equal` split every remainder is
      identical, so the whole thing is one tie — breaking it by id means the same unlucky member
      absorbs the extra peso on every expense forever. Derive `offset = uint32(seed) % n` and walk
      the tied members from there in member-id order, wrapping
- [x] Deterministic: the same `(total, weights, seed)` produces byte-identical output every time.
      Sorting within a tie group is what guarantees this; the offset is what makes it fair.
      **You need both** — dropping either is a bug no single-expense test catches
- [x] The six strategies, all resolving to `(memberId, amount)` pairs summing exactly to the total:
      - `equal` — every current member, weight 1
      - `equal_subset` — a chosen subset, weight 1
      - `shares` — integer weights ≥ 1
      - `percentage` — **basis points, integers, summing to exactly `10000`**. Never a float
        percentage. `60%` is `6000`
      - `exact` — caller-supplied amounts; validated to sum to the total and **rejected otherwise,
        never adjusted to fit**
      - `loan` — one payer, one split member at 100%. Sugar over a one-member split; **no
        `is_loan` column, no distinct row type**
- [x] `percentage` rejects a basis-point sum ≠ `10000` with the actual sum in `details`
- [x] `exact` rejects with `expected`, `actual`, and `difference` in `details` — the split editor
      renders that difference live, so it must be structured, not a message
- [x] Weights of zero are rejected. A member with a zero share should not be in the split at all
- [x] Tests per [splitting.md](../../docs/context/splitting.md) § 8, including the worked example:
      `100.000 COP` three ways yields `33.333 / 33.334 / 33.333` summing to the total, and the
      leftover unit lands on a **different** member for a different seed

## Out of scope

Persistence (T033). The property harness (T032 — but write it next; this task's correctness is
what it exists to check). The UI (T065).

## Files likely touched

```
src/lib/money/apportion.ts
src/lib/money/strategies/{equal,shares,percentage,exact,loan}.ts
src/lib/money/*.test.ts
```
