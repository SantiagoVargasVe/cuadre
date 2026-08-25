---
id: T042
title: Debt simplification
epic: E5-balances
status: todo
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

- [ ] `simplify(balances): Edge[]` — pure, no I/O, no persistence
- [ ] Greedy largest-debtor / largest-creditor matching per
      [splitting.md](../../docs/context/splitting.md) § 5
- [ ] **Ties break by member id**, so the plan is deterministic and doesn't reshuffle on refresh
- [ ] **At most `n − 1` edges** for `n` members with non-zero balances. Assert it
- [ ] **Every member's net position is preserved.** Simplification only re-routes who hands money
      to whom. Property test, not a comment
- [ ] Terminates: each iteration zeroes at least one participant
- [ ] **Do not attempt to minimize the edge count optimally.** That is NP-hard — it contains
      subset-sum — and `n−1` is the bound that matters on a six-person trip. If a future task
      proposes a search here, it contradicts the ADR
- [ ] **Nothing is written.** No table, no column, no migration. The only persisted thing is
      `groups.simplify_debts`, a display boolean
- [ ] Each edge carries `explains[]` — the raw pairwise debts it replaced — so the UI can answer
      "why am I paying someone I never bought anything with"
- [ ] Runs per currency. A group with no display currency gets one plan per currency
- [ ] Enable the `simplify preserves every net` and `|simplify| ≤ n−1` properties in
      [T032](T032-property-invariants.md)'s harness
- [ ] Tests: the classic A→B, C→B case collapses correctly; an already-settled group yields zero
      edges; a group where one member owes everyone yields exactly `n−1`; output is stable across
      repeated runs

## Out of scope

The toggle endpoint (T022, already built). The balances endpoint (T044). The UI (T066).

## Files likely touched

```
src/lib/money/simplify.ts
src/lib/money/simplify.test.ts
```
