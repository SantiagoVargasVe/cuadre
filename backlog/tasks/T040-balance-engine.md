---
id: T040
title: Balance engine — net position per member, per currency
epic: E5-balances
status: todo
depends_on: [T033, T032]
size: M
---

## Context

The function everything in M4 and half of M2 depends on: `GET /api/groups`, member removal, the
balances view, and the simplification input all come from here. It is pure arithmetic over ledger
rows, and its output correctness is asserted by an invariant that must never be relaxed.

Read [splitting.md](../../docs/context/splitting.md) § 4 and
[architecture.md](../../docs/context/architecture.md) § *Data flow: reading balances*.

## Acceptance criteria

- [ ] `computeBalances(ledger): Map<CurrencyCode, Map<MemberId, Balance>>` where `Balance` is
      `{ paid, owed, sent, received, net }`, all `bigint`
- [ ] `net = paid − owed + sent − received`. Positive means the group owes them
- [ ] **Balances are computed per currency, independently.** Never summed across currencies. A
      member can be up in COP and down in USD, and those are two separate positions
- [ ] **`Σ net == 0` is asserted per currency.** If it fails, **throw** — do not return a
      plausible-looking number. This assertion is the canary for every class of bug in this app
- [ ] Deleted expenses and settlements excluded via `liveExpenses` / the settlement equivalent
- [ ] Removed members still appear if they have historical rows; they simply cannot be transacted
      with any more
- [ ] The service issues **one query** for the group's live ledger rows, then computes in
      `src/lib/money/`. No N+1 per member
- [ ] **No cached balances table, no denormalized column.** A stored balance that can disagree with
      the ledger is the exact failure this design avoids. Adding one needs evidence from a real
      group plus an ADR
- [ ] Enable the `Σ net over members == 0` property in
      [T032](T032-property-invariants.md)'s harness
- [ ] Tests: a single expense split three ways; multi-payer; a settlement clearing a debt exactly;
      a settlement overshooting and flipping the sign; a mixed-currency group producing two
      independent position sets

## Out of scope

Pairwise attribution (T041), simplification (T042), the endpoint (T044), conversion (T054).

## Files likely touched

```
src/lib/money/balances.ts
src/server/services/balances.ts
src/lib/money/balances.test.ts
```
