---
id: T081
title: Insights — spend over time, by member, and by category
epic: E9-insights
status: done
depends_on: [T080, T044, T054, T090]
size: L
---

## Context

The first charts in the app, and the ones that establish the pattern the rest of E9 reuses. They
come **after** T080 and T090 on purpose: CSV is the escape hatch, and a chart of an untrustworthy
or uncategorisable ledger is worse than no chart ([roadmap.md](../../docs/roadmap.md) § E9).

**No charting library — decided 2026-09-01.** The three shapes this epic needs (a bar series over
time, a horizontal bar per member, a donut or stacked bar per category) are a few dozen lines of
SVG each over data the server has already aggregated. Recharts costs ~100 KB gzipped, drags in D3
submodules, and its theming actively fights the OKLCH tokens and the measured contrast rules in
design-system.md. Adding it would need an ADR under
[architecture.md](../../docs/context/architecture.md); hand-rolled SVG needs none.

**This task owns the shared chart primitives.** T082 and T084 consume them and must not fork them.

Read [design-system.md](../../docs/frontend/design-system.md) — especially *Money semantics*,
*Contrast*, and *Why colour alone genuinely cannot carry credit vs. debit* —
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*,
[currency.md](../../docs/context/currency.md),
[api-contract.md](../../docs/context/api-contract.md), and
[security.md](../../docs/context/security.md).

## Acceptance criteria

- [x] `GET /api/groups/:id/insights` returns **server-computed** aggregates. The client renders and
      never aggregates money itself — same rule as balances (frontend/CLAUDE.md § *Data loading*).
      Membership verified inside the service; non-member and removed member get `404`
- [x] Aggregates returned, each in minor units with an explicit currency:
      **by period** (day and month buckets over `expense_date`), **by member** (what each member's
      splits total), and **by category** (T090's keys, with `null` bucketed as its own
      "sin categoría" entry — never silently folded into `otro`)
- [x] **Never sum across currencies.** A group with COP and USD returns one block per currency and
      renders one chart per currency with its own heading. No combined total, and no layout that
      implies one. When a display currency is pinned, the converted figures are used and are
      **labelled as converted**, with the pin's date and source reachable — an unlabelled converted
      chart is the same trust bug as an unlabelled converted amount
- [x] Charts are hand-rolled SVG in `src/app/_ui/charts/`, one component per file under the
      100-line limit, driven entirely by design tokens. **No hardcoded colour anywhere**, correct
      in light and dark
- [x] **Colour is never the only encoding.** Every series carries a label, and every bar its value
      as text. The `--credit`/`--debit` pair is 1.08:1 against each other and near-identical under
      deuteranopia — design-system.md spells this out; a legend that only differs by hue is not
      acceptable in this app
- [x] Accessible: each chart is `role="img"` with a `<title>`/`<desc>`, **and** the same numbers are
      available as a visually-hidden table. A screen-reader user gets the data, not "chart"
- [x] Money rendered through `<Money>` / `src/lib/money/format.ts` everywhere a number is shown —
      axis labels included. No `Intl` call in a chart component. Tabular figures in any column
- [x] Works at 375px: no horizontal scroll, no overlapping tick labels, touch targets ≥ 44px. The
      month axis degrades to abbreviated labels rather than rotating text
- [x] Empty and single-expense groups render a calm empty state, not an axis with no bars
- [x] Deleted expenses are excluded (`liveExpenses`); settlements are **not** spending and never
      appear in these totals
- [x] Tests: the aggregation service (per period, per member, per category, multi-currency, with
      and without a pin), authorization, the null-category bucket, and that a component renders the
      hidden table. **Do not** snapshot-test SVG path strings — assert the values
- [x] `docs/context/api-contract.md` documents the endpoint

## Out of scope

- Per-member paid-vs-consumed (T082) and the summary card (T084) — both build on the primitives
  this task creates
- Any charting library, and any new runtime dependency
- Date-range filtering or a custom period picker. Fixed day/month buckets over the group's own span
- Export of a chart as an image
- Cross-group insights — [roadmap.md](../../docs/roadmap.md) § E11, unresolved by design

## Files likely touched

```
src/app/api/groups/[id]/insights/route.ts
src/server/services/insights.ts
src/app/_ui/charts/BarSeries.tsx
src/app/_ui/charts/ChartFrame.tsx
src/app/_ui/charts/HiddenDataTable.tsx
src/app/(app)/g/[groupId]/insights/page.tsx
src/app/_shell/GroupTabs.tsx
src/lib/i18n/es.ts
docs/context/api-contract.md
```
