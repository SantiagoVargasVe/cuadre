---
id: T113
title: Give insight chart labels room to breathe
epic: E12-first-use
status: done
depends_on: [T081, T082]
size: S
---

## Context

The deployed Análisis tab is hard to scan because the shared chart primitives place their value
labels almost on top of the bars. In `PairedBars`, for example, each amount's baseline is only
three SVG units above its track; the 10px glyphs visually touch the bar. `BarSeries` has the same
problem at a slightly less severe six units. This is shared geometry, not a one-off margin in the
member breakdown, so fix the primitives once for every insight chart.

Read [design-system.md](../../docs/frontend/design-system.md) — especially *Contrast*, *Money
display*, and the 100-line component rule — [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) §
*Responsive* and *Accessibility*, and [testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [ ] `BarSeries` and `PairedBars` reserve visibly separate rows for text and bar tracks. Every
      metadata baseline is at least 10 CSS/SVG pixels above its corresponding track, and each
      component's height accounts for the added space so no bar is clipped or encroaches on the
      next item
- [ ] Visible chart labels and values are at least 12px. Amounts remain right-aligned and use
      tabular figures; member, date, and category labels remain left-aligned
- [ ] At 375px, 768px, and the app's 672px maximum content width, a long member/category label and
      a long formatted amount never overlap. The amount wins horizontal space; the descriptive
      label truncates or moves to its own line without hiding the exact value
- [ ] Paid and consumed remain explicit words next to their values. Colour stays decorative and
      is never the only way to distinguish the paired bars
- [ ] Existing chart accessibility survives unchanged: `role="img"`, `<title>`/`<desc>`, and the
      caller's equivalent visually hidden table. Do not shrink or scale SVG text with a `viewBox`
- [ ] All fills and text continue to use design tokens in light and dark mode; no hardcoded colour
      and no charting dependency
- [ ] Component tests cover both primitives with multiple rows, long labels, and large formatted
      values. Assert user-visible labels, values, and accessible names rather than snapshotting SVG
      path/geometry strings
- [ ] `npm run test:ci` passes

## Out of scope

- Reordering, regrouping, or redesigning the Análisis page — T114 owns its information hierarchy
- Changing insight aggregates, the API response, money formatting, or balance semantics
- Introducing a charting library or app-wide typography changes

## Files likely touched

```
src/app/_ui/charts/BarSeries.tsx
src/app/_ui/charts/PairedBars.tsx
src/app/_ui/charts/BarSeries.test.tsx
src/app/_ui/charts/PairedBars.test.tsx
```
