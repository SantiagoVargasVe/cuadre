---
id: T066
title: Balances view and the simplify toggle
epic: E7-frontend
status: todo
depends_on: [T060, T061, T044]
size: M
---

## Context

The Balances tab — the app's actual output. Its hardest requirement isn't rendering the numbers,
it's making a simplified payment plan **believable** to someone being told to pay a person they
never bought anything with.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Balances and the simplify toggle* and
[splitting.md](../../docs/context/splitting.md) § 5.

## Acceptance criteria

- [ ] Per-member summary: paid, share, net — sign and word, never colour alone
- [ ] The payment plan: who pays whom, how much
- [ ] Simplify is a `Switch` that **`PATCH`es the group** and re-renders. Not a client-side
      transform, and no local "simplified" state to drift
- [ ] **A simplified edge is explainable.** Tapping a payment shows the raw debts it replaced,
      from the API's `explains[]` — "pagas a Ana $ 40.000; reemplaza lo que le debías a Beto y lo
      que Beto le debía a Ana". Without this the plan looks arbitrary and members stop trusting it
- [ ] **Never a negative amount as a direction.** "Ana te debe $ 20.000" and "le debes a Ana
      $ 20.000" are different sentences, not one number with a sign
- [ ] Multi-currency: **one block per currency**, separate headings, no combined total, and no
      layout that implies one
- [ ] With a display currency set, amounts are labelled and the pin's date and source are reachable
      in one tap
- [ ] Balances are **always from `GET /api/groups/:id/balances`**, never computed client-side from
      the feed
- [ ] A settled group reads as settled — a calm zero state, not an empty table
- [ ] Every amount has an accessible label naming whose it is
- [ ] Tests: toggling calls the `PATCH` and re-renders; `explains` renders on tap; a mixed-currency
      group renders separate blocks with no total; the zero state renders

## Out of scope

Settle-up (T067). The currency switcher (T068).

## Files likely touched

```
src/app/g/[groupId]/balances/page.tsx
src/app/g/[groupId]/_components/{balance-row,payment-plan,simplify-toggle}.tsx
```
