# Product Context

## The problem

A group of friends goes on a trip. Expenses land unevenly: one person books the accommodation
months ahead, another pays for the rental car, a third covers dinner because someone's card was
declined and that part is really a loan, not a shared cost. Some of it is in COP, some in USD.

Nobody tracks it properly in the moment, so at the end the group reconstructs a week of spending
from memory and screenshots, and somebody quietly eats the difference.

## The shape of the solution

A shared ledger per group. Each expense records **who actually paid** and **who it was for**, in
the currency it was paid in. Everything else — balances, who pays whom, the short list of
payments that settles the trip — is derived from that ledger, never entered by hand.

Two things are toggles over the same underlying data, not destructive actions:

- **Simplify debts** — show the fewest payments that settle everyone, instead of the raw
  pairwise IOUs
- **Display currency** — show a mixed-currency group in one currency, at a rate pinned when the
  member asked for it

Both can be switched off and the group is exactly where it was.

## Users

Small private groups — friends, family, travel companions. Realistically 2–15 people per group,
tens to low hundreds of expenses per trip. One person is comfortable enough with the app to set
the group up; everyone else needs to add an expense from a phone in under fifteen seconds.

Registration is invite-only ([ADR-0002](../adr/0002-invite-only-registration.md)): the site is
publicly reachable, and an open signup form on a public URL is a bot magnet with no upside here.

**Spanish-first.** The primary users are Colombian; COP is the default currency and `es-CO` the
default locale. English is a later locale, not a parallel one.

## Core flows

**Create a group and invite people**
1. Title, description, and the group's default currency (COP unless changed)
2. Mint an invite link and send it over WhatsApp
3. A recipient who already has an account joins the group; one who doesn't registers *through*
   that link and lands in the group — the group invite doubles as a registration invite

**Add an expense** — the flow that has to be fast
1. Title, amount, currency (defaults to the group's), date (defaults to today)
2. **Paid by** — defaults to you, alone
3. **Split between** — defaults to every member, equally
4. Save

Steps 2 and 3 are what the whole data model exists for, and 90% of the time neither is touched.
The form must not make the common case pay for the flexible one.

**Split it a different way**
- Equally among a subset ("this one was just the four of us")
- By percentage ("she covers 60%")
- By exact amounts ("my dish was 42.000")
- By shares ("the couple counts as two")
- As a loan — one payer, one beneficiary, 100% ("I spotted him for the ticket")

**See where everyone stands**
- Per member: total paid, total share, and the net
- The payment plan: who pays whom, and how much
- Toggle **simplify** to collapse that plan; toggle it back

**Settle up**
- Record that a payment happened. It's a ledger entry like any other, so balances move and the
  group can actually reach zero.

## Decisions already made

Don't relitigate these without an ADR:

- **Invite-only registration.** [ADR-0002](../adr/0002-invite-only-registration.md)
- **No `paid_by` column.** An expense has a list of payers and a list of splits, and they must
  balance. One payer is the common case, not the schema.
  [ADR-0005](../adr/0005-expense-as-balanced-ledger-entry.md)
- **Money is integer minor units.**
  [ADR-0004](../adr/0004-money-as-integer-minor-units.md)
- **Simplification is derived, never stored.**
  [ADR-0006](../adr/0006-simplification-is-derived.md)
- **Converting a group's currency never rewrites an expense.**
  [ADR-0007](../adr/0007-reversible-display-currency.md)
- **Settlements are ledger entries**, not a separate "mark as paid" flag.
  [ADR-0009](../adr/0009-settlements-are-ledger-entries.md)

## Out of scope for v1

Deliberately not built — not merely unbuilt. Re-adding any of these needs a reason written down.

- **Payment rails.** Cuadre records that a payment happened; it never moves money. No PSE, no
  Nequi, no card, no bank integration. That changes the app's regulatory surface entirely.
- **Debt between people who share no group.** Balances are always scoped to one group. A global
  "you and Ana across all trips" view is a post-MVP idea with real UX ambiguity.
- **Per-member preferred display currency.** The display currency is a *group* setting, so every
  member sees the same numbers and the same payment plan. Two members reading different totals
  for the same debt is a support burden, not a feature.
- **Live/streaming FX.** Rates refresh once a day and a group's rate is pinned on conversion.
  See [currency.md](currency.md).
- **Receipt photos, comments, recurring expenses, notifications.** All post-MVP, see
  [roadmap.md](../roadmap.md).
- **Charts and CSV export.** Explicitly post-MVP (E9) — the ledger has to be trustworthy before
  visualising it is worth anything.

## What "done" looks like for v1

A group of six can plan a real trip in it:

- Everyone registers through an invite link and joins the group
- Expenses go in from a phone, in COP and USD, with the default split, in seconds
- The awkward ones — 60/40, a loan, a subset dinner, two people splitting the hotel bill — all
  go in without anyone doing arithmetic by hand
- At the end, the group flips on **simplify**, sees a handful of payments, makes them, records
  them, and the balances read zero
- Somebody flips the group to USD to see the whole trip in one number, then flips it back, and
  nothing about the underlying ledger has changed
