# ADR-0006 — Debt simplification is derived at read time and never stored

**Status:** Accepted · 2026-08-25

## Context

Groups want "simplify debts": collapse a tangle of IOUs into the fewest payments that settle
everyone. The requirement was explicit that this must be **reversible** — a group can turn it on
and off as they wish.

The tempting implementation is to compute the simplified plan when the toggle is switched on and
store the resulting debts, because the plan is what the UI renders and recomputing it on every
read looks wasteful.

## Decision

Simplification is a **pure function of the net balances, computed on every read**. Nothing writes
a simplified debt. The only thing persisted anywhere is `groups.simplify_debts` — a boolean
display preference.

## Why storing it is wrong, not merely more work

Reversibility is the giveaway. If the simplified plan is stored, turning the toggle **off** means
*un*-deriving it: reconstructing the original pairwise debts from a set of edges that deliberately
threw that information away. The raw debts would have to be kept alongside, which means two
representations of the same truth that can drift — and the moment an expense is edited while
simplify is on, they have drifted.

Deriving it every time makes "on" and "off" the same data rendered two ways. The toggle stops
being an operation at all; it's a query parameter. There is nothing to reverse because nothing
happened.

The performance objection doesn't survive contact with the numbers: a group is 2–15 members and a
few hundred expenses. That's one indexed query plus arithmetic over a few hundred rows.

## The algorithm

Greedy largest-debtor / largest-creditor matching over net balances, ties broken by member id so
the output is deterministic and doesn't reshuffle on refresh. At most `n−1` payments.

**It does not always minimize the payment count.** Doing so optimally is NP-hard — it contains
subset-sum. `n−1` is the bound that matters at group scale, and nobody on a six-person trip
notices the difference between four payments and the theoretical three. Do not replace this with
a search.

Full specification: [splitting.md](../context/splitting.md) §5.

## Consequences

- No `simplified_debts` table, no `is_simplified` column, and no migration writes one. If a future
  task proposes caching the plan, it contradicts this ADR and needs to supersede it.
- **Every member's net position is unchanged by simplification** — it only re-routes who hands
  money to whom. This is a property test, not a comment.
- Settlements need no awareness of simplification. A settlement is a ledger entry between two
  members, so it moves net balances identically whether the toggle is on or off. Someone can pay
  along a simplified edge, toggle simplify off, and the raw view still nets correctly. There is no
  reconciliation step and no "this payment belonged to a simplified plan" state.
- The API exposes `?simplify=on|off` as a **preview override** that never writes. Flipping it for
  the group is a `PATCH` on the group.
- Simplification can tell Caro to pay Ana when they never shared an expense. That is correct and
  socially surprising, so the API returns `explains[]` — the raw debts each edge replaced — and
  the UI must be able to show them. This is why the pairwise view has to keep working while
  simplify is on, and another reason neither view can be the stored one.
