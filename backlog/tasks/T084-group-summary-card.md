---
id: T084
title: Group summary card — totals, biggest expense, who's carrying the trip
epic: E9-insights
status: todo
depends_on: [T081]
size: S
---

## Context

The one-glance answer at the top of the insights tab: what this trip cost, over how long, and who
is currently fronting it. It is the cheapest item in E9 and probably the most looked-at — most
people will read this card and never scroll to a chart.

Read [design-system.md](../../docs/frontend/design-system.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*, and
[api-contract.md](../../docs/context/api-contract.md).

## Acceptance criteria

- [ ] Reads from T081's insights endpoint — **no new endpoint, no client-side aggregation**
- [ ] Shows, per currency: total spent, expense count, the date span covered, the average per
      expense, and the largest single expense (title + amount + who paid)
- [ ] "Who's carrying the trip" is the member with the **largest positive net** — phrased as a
      sentence, never a bare signed number. "Ana ha puesto $ 340.000 de más" beats "+340.000".
      Never show a negative amount as a payment direction (frontend/CLAUDE.md)
- [ ] **One card per currency when the group has several**, with its own heading, and no combined
      total anywhere. When a display currency is pinned, the card is in that currency and says so,
      with the pin date reachable
- [ ] A group with zero expenses renders a calm empty state, not zeros in every slot
- [ ] Ties are handled deterministically (documented tie-break, not whatever the array order was)
- [ ] Tabular figures; every amount through `<Money>`; every string through i18n keys; correct at
      375px in light and dark
- [ ] Tests: the largest-expense pick including a tie, the carrying-member pick including a tie and
      an all-settled group (where nobody is carrying anything — say that, don't name someone at
      zero), a multi-currency group, and the empty state

## Out of scope

- New aggregation. If a figure this card wants isn't in T081's response, extend T081's service
  deliberately — do not compute it in the component
- A shareable/exportable image of the card
- Per-category summary — that is T081's chart, not this card

## Files likely touched

```
src/app/(app)/g/[groupId]/insights/_components/SummaryCard.tsx
src/server/services/insights.ts
src/lib/i18n/es.ts
```
