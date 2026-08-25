# ADR-0007 — Converting a group's currency is a reversible display setting, not a rewrite

**Status:** Accepted · 2026-08-25

## Context

A trip mixes currencies: the flights in USD, everything on the ground in COP. Groups want to see
the whole thing in one number. The original requirement described converting all expenses at once
and **not keeping the original currencies**, with the explicit note that a later rate change
should not retroactively move the totals.

Read literally, that's a destructive `UPDATE` over every expense in the group.

## Decision

**An expense is always stored in the currency it was entered in.** Converting a group writes two
things and touches no expense row:

```
groups.display_currency = 'USD'
group_fx_pins (group_id, from_currency, to_currency, rate, as_of, source, pinned_at, pinned_by)
```

One pin per currency present in the group. Every read converts at the pinned rate. Clearing
`display_currency` reverts to per-currency display, and the pins are **kept** so re-enabling the
same conversion reproduces the same numbers.

## Why not the destructive rewrite

The stated requirement — *the rate moved, don't recalculate* — is fully satisfied by pinning. That
was the only thing the rewrite bought, and pinning provides it without the cost.

The cost is severe. A conversion is one tap, and the ledger it rewrites is **not
reconstructable** — there is no external source to re-derive a trip's expenses from, unlike a
wishlist item and its URL. A mis-tap converting a COP trip to EUR would mean re-entering a week of
spending by hand, and the app would have no way to even tell the user what the numbers used to be.

It also makes the app inconsistent with itself. Simplify is a reversible toggle over derived data;
under the rewrite, convert would be the one irreversible action in the product, sitting one tab
away in the same settings screen.

Two columns of pinned rate data cost nothing next to that.

## How conversion actually works

Per row, then re-apportioned — never on a net balance:

```
converted_total  = convert(expense.total, pinned_rate)
converted_splits = apportion(converted_total, weights = original split amounts)
converted_payers = apportion(converted_total, weights = original payer amounts)
```

Re-apportioning by the original amounts as weights is what keeps `Σ splits == total` true *after*
conversion, for every strategy including `exact`, without knowing which strategy produced the row.
Converting each split independently would not: three converted rows routinely miss their converted
total by a unit, and that unit is an unbalanced expense.

Rounding, the scaled-integer arithmetic, and a worked example are in
[currency.md](../context/currency.md).

## Consequences

- **Pins never refresh themselves.** No cron job, no cache expiry, no "this rate looks stale"
  heuristic may update `group_fx_pins`. Only an explicit member re-pin. This is a product promise
  and it is stated as a non-negotiable in `CLAUDE.md`.
- Re-`PUT`ting the same display currency re-pins at today's rates. That is the *only* thing that
  moves an already-converted group's numbers, and it is always a deliberate action.
- Display currency is a **group** setting, not per member. Two members reading different totals for
  the same debt is a support burden, not a feature.
- The UI must label converted amounts and make the pin's date and source reachable in one tap. A
  number that quietly changed currency destroys trust faster than a wrong one does.
- A group with no display currency shows balances **per currency**, as separate blocks that must
  never be summed.
