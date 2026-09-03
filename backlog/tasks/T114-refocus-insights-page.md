---
id: T114
title: Refocus Análisis on useful group decisions
epic: E12-first-use
status: done
depends_on: [T113]
size: M
---

## Context

The summary card at the top of Análisis gives a useful one-glance answer and should stay. Below
it, the page currently gives the timeline, paid-vs-consumed breakdown, and category breakdown the
same visual weight as three independent cards. That makes a short page feel cumbersome, and it
renders low-information charts as if they were insights: a one-day timeline repeats the summary,
while a single 100% `Sin categoría` bar only says that the expenses still need categorising.

Turn the existing aggregates into a progressive, question-led detail surface without changing
the endpoint. The priority after the summary is: who contributed and where the group stands, where
the money went, then how spending changed when there are enough periods to show a change.

Read [product.md](../../docs/context/product.md),
[splitting.md](../../docs/context/splitting.md) — paid, consumed, and settlement-aware current
balance must remain distinct — [design-system.md](../../docs/frontend/design-system.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Data loading*, *Multi-currency display*,
*Responsive*, and *Accessibility*, and [testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [ ] Keep the currency heading/conversion-rate affordance and T084 summary card first. Preserve
      every summary field and the settlement-aware "who is carrying" sentence; this task does not
      redesign or re-aggregate the part users already find useful
- [ ] Replace the three equal-weight cards below the summary with one coherent detail surface,
      divided into semantic sections rather than nested cards. Its DOM and visual order is:
      **Aportes y balance**, **En qué se gastó**, then **Evolución del gasto** when present
- [ ] **Aportes y balance** keeps every member visible, including zero-activity and removed members
      returned by the endpoint. For each member it shows paid, consumed, and the settlement-aware
      current balance together, with words as well as colour for the balance direction. The layout
      uses T113's readable paired-bar geometry and does not repeat the same member in a detached
      balance list
- [ ] **En qué se gastó** shows the existing category distribution when there are at least two
      meaningful buckets. With one named category, use a compact sentence naming that category and
      its amount instead of a full-width one-bar chart. When every expense is `Sin categoría`,
      replace the meaningless 100% bar with concise Spanish guidance and a 44px-minimum action back
      to that group's Gastos tab so the user can categorise expenses. Do not silently fold `null`
      into `otro`
- [ ] **Evolución del gasto** renders only when the selected day/month series has at least two
      buckets. With a single bucket, omit the section—the summary already states the period and
      total—rather than showing a one-bar "trend" or an empty-state card
- [ ] All retained charts keep their visible exact values, accessible name/description, and
      equivalent visually hidden table. Headings form a logical hierarchy, keyboard focus is
      visible on the categorisation action, and no information is encoded by colour alone
- [ ] One currency still produces one independent summary + detail block. Multiple currencies are
      never summed or visually grouped as one total; converted blocks retain the pin date/source
      affordance
- [ ] At 375px, 768px, and 1280px the detail surface has no horizontal scroll, no overlapping
      labels, and no nested-card visual clutter. Keep the app's existing single-column content
      width rather than introducing an Análisis-only breakout
- [ ] Every visible string comes from i18n and every amount from the existing money formatter /
      `<Money>`. The client may choose presentation from bucket counts but must not aggregate or
      calculate money
- [ ] Component tests cover the section order; a one-period series; an all-uncategorised group and
      its Gastos action; a single named category; a real multi-category + multi-period group;
      zero-activity members; and separate multi-currency blocks
- [ ] `npm run test:ci` passes

## Out of scope

- Any endpoint, service, schema, or aggregate change; date filters; custom ranges; new metrics; or
  client-side money arithmetic
- Redesigning the summary card, the group-level navigation, or the global `max-w-2xl` app shell
- Categories per member, chart export, cross-group insights, or a charting library

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/InsightsCurrencySection.tsx
src/app/(app)/g/[groupId]/_components/InsightsTab.test.tsx
src/app/(app)/g/[groupId]/insights/_components/MemberBreakdown.tsx
src/app/(app)/g/[groupId]/insights/_components/MemberBreakdown.test.tsx
src/app/_ui/charts/ChartFrame.tsx
src/lib/i18n/es.ts
```
