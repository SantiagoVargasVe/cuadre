---
id: T116
title: Copy the current payment plan for sharing
epic: E10-quality-of-life
status: todo
depends_on: [T066, T104, T115]
size: M
---

## Context

Balances already answers who should pay whom, but coordinating the transfers still means
rewriting each row by hand in WhatsApp. Add one *Copiar plan de pagos* action that turns the plan
currently on screen into concise Spanish text ready to paste, including enough group and currency
context that the message remains understandable outside Cuadre.

The copied plan is presentation of `GET /api/groups/:id/balances`, not another balance engine. It
must use the latest raw or simplified plan returned by the server, preserve each currency as an
independent block, and never derive, net, convert, sort, or sum money in the client.

Read [product.md](../../docs/context/product.md),
[splitting.md](../../docs/context/splitting.md) § *Balances* and *Simplification*,
[currency.md](../../docs/context/currency.md) § *Pinned rates* and *Display currency*,
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Balances and the simplify toggle*,
*Multi-currency display*, *Responsive*, and *Accessibility*,
[design-system.md](../../docs/frontend/design-system.md), and
[testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [ ] Add one *Copiar plan de pagos* action to the Balances tab when at least one current plan edge
      exists. Pass the group title from the server-rendered balances page so the copied heading is
      `Plan de pagos — {group title}`. Hide the action for a fully settled group rather than
      copying an empty message
- [ ] Build the clipboard text with a pure, unit-tested formatter. Each actionable edge uses
      neutral third-person wording—`{from} le paga a {to} {amount}`—so the same message is correct
      no matter which member copies it. Resolve names from the group member data, preserve the
      plan's server order, and format every amount with the existing money formatter
- [ ] Include one clearly headed block for every currency with a non-empty plan, even when there
      is only one. Separate blocks with whitespace, omit empty blocks, and never sum them or imply
      a combined total. Do not copy `explains[]`; the shared message is the actionable plan, not
      its in-app audit detail
- [ ] When the balance response has a display currency and pinned rates, state that the amounts
      are converted and append each pin's currency pair, decimal rate, source, and `asOf` date.
      Preserve the API's exact decimal string—never round-trip a rate through `Number`—and reuse
      the existing conversion-rate copy/date formatter where possible
- [ ] Copy exactly the plan represented by the latest balance query data. Toggling simplification,
      recording/editing/deleting a settlement, or any other existing `['group', groupId]`
      invalidation updates what the next copy produces; no stale initial response is retained
- [ ] Use `navigator.clipboard.writeText` from an explicit user action. Announce success with a
      visible *¡Copiado!* state and an `aria-live` status; on rejection, retain the plan, do not
      claim success, and show an accessible Spanish error that lets the user try again
- [ ] The action remains easy to reach without crowding the simplify switch or *Registrar pago*.
      It has a minimum 44px target, visible keyboard focus, and a clean stacked layout at 375px;
      verify 375px, 768px, and 1280px in light and dark mode
- [ ] Tests assert the exact copied text for a third-party edge, multiple edges, multiple
      currencies, and a converted plan with pin provenance; they also cover the latest simplified
      plan after a refetch, clipboard success and failure, unknown/removed historical member name
      fallback, and the settled state with no copy action
- [ ] All visible and copied strings come from i18n, no endpoint or runtime dependency is added, and
      `npm run test:ci` passes

## Out of scope

- Sending a WhatsApp message, opening a WhatsApp deep link, the Web Share API, contact lookup, or
  any server-side notification/integration
- Recomputing or changing pairwise attribution, simplification, settlements, conversion, pinned
  rates, or the balances endpoint
- Copying balance summaries, paid/consumed rows, `explains[]`, settlement history, or arbitrary
  user-authored text
- A "duplicate expense" action; it was considered alongside these improvements and is not a
  current product priority

## Files likely touched

```
src/app/(app)/g/[groupId]/balances/page.tsx
src/app/(app)/g/[groupId]/_components/BalancesTab.tsx
src/app/(app)/g/[groupId]/_components/BalancesTab.test.tsx
src/app/(app)/g/[groupId]/_components/CopyPaymentPlanButton.tsx
src/app/(app)/g/[groupId]/_components/formatPaymentPlanForClipboard.ts
src/app/(app)/g/[groupId]/_components/formatPaymentPlanForClipboard.test.ts
src/lib/i18n/es.ts
```
