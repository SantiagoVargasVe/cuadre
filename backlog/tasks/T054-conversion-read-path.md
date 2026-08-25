---
id: T054
title: Conversion on the balance read path
epic: E6-currency
status: todo
depends_on: [T053, T044]
size: M
---

## Context

Where pinned rates actually change what a member sees. The rule that makes this work for every
split strategy — including `exact`, where there is no strategy to re-run — is to convert the
expense **total** and then re-apportion by the original amounts as weights.

Read [splitting.md](../../docs/context/splitting.md) § 6 and
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md) § *How conversion actually works*.

## Acceptance criteria

- [ ] When a group has a `display_currency`, every expense not already in it is converted:
      ```
      converted_total  = convert(expense.total, pinned_rate)
      converted_splits = apportion(converted_total, weights = original split amounts)
      converted_payers = apportion(converted_total, weights = original payer amounts)
      ```
- [ ] **Never convert a net balance directly**, and never convert each split row independently —
      three independently converted rows routinely miss their converted total by a unit, and that
      unit is an unbalanced expense
- [ ] Re-apportionment uses the **same seed** (the expense id) as the original split, so the
      remainder lands consistently
- [ ] Settlements convert as a single amount — nothing to apportion
- [ ] `Σ splits == total` holds **after** conversion, for every strategy including `exact`
- [ ] `Σ net == 0` still asserted, now in the display currency
- [ ] `GET /api/groups/:id/balances` returns exactly one `byCurrency` entry when a display currency
      is set, carrying the pin metadata (`asOf`, `source`) so the UI can label it
- [ ] The expense feed reports converted amounts **and** the original, so the UI can show both
- [ ] Enable the `convert preserves Σ splits == total` property in
      [T032](T032-property-invariants.md)'s harness
- [ ] Tests: a mixed COP/USD group converts to one entry summing to zero; an `exact` split
      re-apportions and still balances; clearing the display currency returns identical numbers to
      before it was set; converting and re-clearing repeatedly is stable

## Out of scope

The UI (T066, T068). Per-member display currency — explicitly rejected for v1.

## Files likely touched

```
src/server/services/balances.ts
src/lib/money/convert.ts
src/app/api/groups/[id]/balances/route.ts
```
