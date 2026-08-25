# ADR-0005 — An expense is a balanced ledger entry, not a payer plus a split

**Status:** Accepted · 2026-08-25

## Context

The obvious schema for a splitting app is `expenses.paid_by → users` plus a table of who owes
what. It reads naturally, it matches the common case, and it is what most tutorials show.

It also cannot express "Ana put in 200 and Beto put in 100 for the hotel", which came up in the
original requirements as *one or multiple people pay for something*.

## Decision

No `paid_by` column. An expense owns two child tables:

```
expense_payers  (expense_id, user_id, amount)
expense_splits  (expense_id, user_id, amount, weight?)
```

with a single invariant, enforced everywhere:

```
Σ payers.amount == expenses.total_amount == Σ splits.amount
```

One payer is the common case of N, not a different shape.

## Why the invariant is enforced three times

1. In `src/lib/money/`, before the service persists anything — this produces the error message
   that names the difference, which the client renders live.
2. Inside the write transaction, after the rows are inserted.
3. By a **deferred constraint trigger** in Postgres, checked at commit.

That looks like belt and braces because it is. The assertion gives a good error; the trigger makes
an unbalanced expense *impossible*, including from a future code path that skips the service —
a data-fix script, a migration, an admin tool nobody has written yet. This is the one class of
corruption from which there is no recovery, because there is no external source to re-derive a
trip's ledger from.

It must be **deferred**: rows have to be insertable in any order within the transaction, and an
immediate trigger fires before the last one lands.

## What this buys beyond multiple payers

The `split_strategy` column becomes advisory. It is stored so the edit form reopens in the mode it
was created in, and **the balance engine never reads it** — the resolved amounts are the truth.
That means:

- A new strategy is a new resolver in `src/lib/money/`. No schema change, no balance-engine change.
- `loan` needs no `is_loan` column. It's one payer and one split member at 100%.
- Currency conversion re-apportions by the stored amounts as weights, so it works for every
  strategy including `exact` without knowing which one produced the row
  ([ADR-0007](0007-reversible-display-currency.md)).

## Consequences

- Every expense write is a multi-row transaction. There is no single-row insert path, and adding
  one would bypass the invariant.
- Child rows carry a denormalized `group_id` purely to support
  `FOREIGN KEY (group_id, user_id) REFERENCES group_members (group_id, user_id)` — making "you
  can't put a non-member on an expense" a database guarantee. Keep it in sync inside the same
  transaction.
- `PATCH` replaces the whole expense rather than patching splits. Resolving a partial split update
  against a stale total is a state nobody should have to reason about.
- The simple case must not pay for this. The API defaults `paidBy` to the authenticated user for
  the full amount, and the UI collapses both editors behind one line of text each.
