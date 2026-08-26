---
id: T042
title: Debt simplification
epic: E5-balances
status: done
depends_on: [T040]
size: M
---

## Context

Collapse a tangle of IOUs into the fewest payments that settle everyone. The requirement was that
this be reversible, and the design that delivers it is that **nothing is stored** — it is a pure
function of net balances, computed on read, so "on" and "off" are the same data seen two ways.

Read [splitting.md](../../docs/context/splitting.md) § 5 and
[ADR-0006](../../docs/adr/0006-simplification-is-derived.md). Both are mandatory here.

## Acceptance criteria

- [x] `simplify(balances): Edge[]` — pure, no I/O, no persistence
- [x] Greedy largest-debtor / largest-creditor matching per
      [splitting.md](../../docs/context/splitting.md) § 5
- [x] **Ties break by member id**, so the plan is deterministic and doesn't reshuffle on refresh
- [x] **At most `n − 1` edges** for `n` members with non-zero balances. Assert it
- [x] **Every member's net position is preserved.** Simplification only re-routes who hands money
      to whom. Property test, not a comment
- [x] Terminates: each iteration zeroes at least one participant
- [x] **Do not attempt to minimize the edge count optimally.** That is NP-hard — it contains
      subset-sum — and `n−1` is the bound that matters on a six-person trip. If a future task
      proposes a search here, it contradicts the ADR
- [x] **Nothing is written.** No table, no column, no migration. The only persisted thing is
      `groups.simplify_debts`, a display boolean
- [x] Each edge carries `explains[]` — the raw pairwise debts it replaced — so the UI can answer
      "why am I paying someone I never bought anything with"
- [x] Runs per currency. A group with no display currency gets one plan per currency
- [x] Enable the `simplify preserves every net` and `|simplify| ≤ n−1` properties in
      [T032](T032-property-invariants.md)'s harness
- [x] Tests: the classic A→B, C→B case collapses correctly; an already-settled group yields zero
      edges; a group where one member owes everyone yields exactly `n−1`; output is stable across
      repeated runs

## Out of scope

The toggle endpoint (T022, already built). The balances endpoint (T044). The UI (T066).

## Files likely touched

```
src/lib/money/simplify.ts
src/lib/money/simplify.test.ts
```

## Implementation notes

`simplify(nets: Map<memberId, bigint>): SimplifiedEdge[]` takes one currency's net positions at
a time — the same per-currency contract T032's property harness already committed to
(`CurrencyNet = { currency, net }`), and the same shape T041's `computePairwise` follows. The
caller (T044) is responsible for looping over currencies.

**`explains[]` needed a second, genuinely separate function**, `explainSimplifiedPlan(edges,
rawDebts)`, rather than folding into `simplify()` itself. `simplify()` only ever sees net
balances — it has no memory of who originally owed whom, so it cannot produce `explains[]` on
its own. The two inputs it needs (the simplified edges and T041's raw pairwise debts) are only
both available to the caller.

The construction: reverse each simplified edge (creditor → debtor instead of debtor → creditor)
and combine it with the raw pairwise debts. Because both sets net to the same value at every
member (T041's own identity), the combined graph has equal inflow and outflow everywhere — a
circulation, which always decomposes exactly into simple cycles (walk forward until a node
repeats, subtract the cycle's bottleneck weight, repeat on what's left). Every cycle that
contains both a raw edge and a reversed-simplified edge is a genuine explanation: that raw debt
is part of the very loop the simplified payment closes. Full derivation is in the doc comment on
`explainSimplifiedPlan` in `simplify.ts`.

One consequence worth flagging: when a simplified payment reroutes a genuine multi-member "swap"
(e.g. two unrelated pairs get crossed into different pairs because it nets out the same), a
single raw debt can legitimately show up in the `explains[]` of *more than one* simplified edge —
because untangling either edge only makes sense by citing the whole swap, not just half of it.
Verified via a dedicated unit test and a property test that checks `explains[]` never fabricates
an amount or cites a debt absent from the raw graph (see `simplify.test.ts` and
`__tests__/properties.test.ts`).

Also fixed a bug in T032's own (until-now-skipped, never-executed) property stub for "preserves
every member's net position": it started from the original net and applied `+amount`/`-amount`
per edge, which simulates *settling* the plan (correctly driving everyone to zero) rather than
checking that the plan *re-derives* the same net it was built from. Corrected to derive net fresh
from the plan's own edges and compare against the input.
