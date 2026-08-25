# ADR-0009 — Settlements are ledger entries, not debts marked paid

**Status:** Accepted · 2026-08-25

## Context

A group needs to record that a payment actually happened, or balances never clear and a finished
trip stays open forever.

The intuitive model attaches the payment to the debt it settles: a plan edge, or a per-pair
balance, gets marked paid. That matches how people describe it — "I paid Ana what I owed her."

## Decision

A settlement is a standalone row: `from → to`, one amount, one currency, one date. It participates
in the balance calculation exactly like an expense does:

```
net(m) = paid(m) − owed(m) + sent(m) − received(m)
```

It is **not** linked to an expense, a pair balance, or a plan edge.

## Why not attach it to a debt

Because the debts it would attach to are **derived**, and one of them is derived differently
depending on a toggle ([ADR-0006](0006-simplification-is-derived.md)).

Under simplification, a plan edge is a synthetic thing that exists only while the toggle is on. A
settlement attached to one would have to survive the toggle being flipped off, at which point the
edge it references no longer exists and there is nothing to reconcile it against. The app would
need a "this payment belonged to a simplified plan" state, and rules for what happens when an
expense is edited underneath it.

As a plain ledger entry, none of that exists. Net balances are invariant under simplification, so
a settlement moves them identically either way. Pay along a simplified edge, toggle simplify off,
and the raw pairwise view still nets correctly — with no reconciliation step anywhere in the
codebase.

The second reason is simpler: **real payments don't match debts.** Someone owing `47.300` sends a
round `50.000`. Under "mark this debt paid" that's an error state or a second partial-payment
concept. As a ledger entry it's just a number, and the remainder flips sign on its own.

## Consequences

- Over- and under-payment are normal and need no special handling.
- Settlements soft-delete and version like expenses, and are excluded from balances when deleted.
- Both participants must be current members; enforced by the same composite FK to `group_members`
  as expense children.
- `CHECK (from_user_id <> to_user_id)`.
- `from_user_id` is always the authenticated user. Recording a payment on someone else's behalf is
  not in v1 — it's a trust question, not a technical one.
- The suggested plan and the recorded settlements are **independent**. The UI may prefill a
  settle-up form from a plan edge as a convenience, but nothing links the resulting row back to it,
  and no code should look for such a link.
