---
id: T084
title: Group summary card — totals, biggest expense, who's carrying the trip
epic: E9-insights
status: done
depends_on: [T082]
size: M
---

## Context

The one-glance answer at the top of the insights tab: what this trip cost, over how long, and who
is currently fronting it. T082 has already added the settlement-aware `currentNet` fields, so this
card must use those rather than treating paid-minus-consumed as a current balance. It is the
cheapest item in E9 and probably the most looked-at — most people will read this card and never
scroll to a chart.

Read [splitting.md](../../docs/context/splitting.md),
[currency.md](../../docs/context/currency.md),
[design-system.md](../../docs/frontend/design-system.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*, and
[api-contract.md](../../docs/context/api-contract.md).

## Acceptance criteria

- [x] Reads from the existing T081/T082 insights endpoint — **no new endpoint and no client-side
      aggregation**. Extend that service server-side with a documented per-currency `summary`:
      `totalSpent`, `expenseCount`, `firstExpenseDate`, `lastExpenseDate`, `averagePerExpense`, and
      `largestExpense` (`title`, amount, currency, and the payer display names). All amounts are
      minor-unit strings; `averagePerExpense` is positive-integer division rounded down to a minor
      unit. `totalSpent`, count, dates, average, and largest expense consider live expenses only;
      settlements are not spending. When a display currency is pinned, use T081/T054's per-expense
      conversion and re-apportionment before aggregating or selecting the largest expense
- [x] Shows the server-provided total spent, expense count, date span, average per expense, and
      largest single expense. Never introduce client-side money arithmetic
- [x] "Who's carrying the trip" is the member with the largest positive **`currentNet` from T082**,
      which includes recorded settlements and therefore agrees with balances. Phrase it as a
      sentence, never a bare signed number. "Ana ha puesto $ 340.000 de más" beats "+340.000".
      Never show a negative amount as a payment direction (frontend/CLAUDE.md)
- [x] **One card per currency when the group has several**, with its own heading, and no combined
      total anywhere. When a display currency is pinned, the card is in that currency and says so,
      with the pin date reachable
- [x] A group with zero expenses renders a calm empty state, not zeros in every slot
- [x] Ties are handled server-side and deterministically: for largest expense, earliest
      `expense_date` then lexicographically lowest expense id; for carrying member,
      lexicographically lowest user id. The UI never depends on query/array order
- [x] Tabular figures; every amount through `<Money>`; every string through i18n keys; correct at
      375px in light and dark
- [x] Tests: the server summary's largest-expense pick including a tie; its rounded average; the
      carrying-member pick including a tie and an all-settled group (where every `currentNet` is
      zero, so nobody is carrying anything — say that, don't name someone at zero); a
      multi-currency group; and the empty state

## Out of scope

- A new endpoint or any client-side aggregation. The narrowly scoped, server-side `summary`
  extension above is required; do not use it as a reason to change T081's charts or T082's member
  accounting
- A shareable/exportable image of the card
- Per-category summary — that is T081's chart, not this card

## Files likely touched

```
src/app/(app)/g/[groupId]/insights/_components/SummaryCard.tsx
src/server/services/insights.ts
src/lib/i18n/es.ts
```
