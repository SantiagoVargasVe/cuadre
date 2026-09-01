---
id: T082
title: Per-member breakdown — what they paid for vs. what they consumed
epic: E9-insights
status: todo
depends_on: [T081]
size: M
---

## Context

The balances view answers "what is my net". This answers the two expense numbers underneath it:
**what I put in** (payer rows) and **what I consumed** (split rows). Those are not the same as the
current balance once a payment has been recorded. Someone who paid 2.000.000 and consumed
1.900.000 has an expense contribution of 100.000; a later settlement can reduce that current net
without changing the history of what they paid for.

Builds directly on the aggregates and the SVG primitives T081 creates. **Do not fork the chart
components.**

Read [splitting.md](../../docs/context/splitting.md) — **mandatory**, this is money —
[design-system.md](../../docs/frontend/design-system.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*, and
[currency.md](../../docs/context/currency.md),
[api-contract.md](../../docs/context/api-contract.md).

## Acceptance criteria

- [ ] Extend T081's insights response — **no second endpoint** — with one row per member and
      currency. Each row has all-bigint-minor-unit fields (serialized as strings): **paid** (Σ live
      `expense_payers` rows), **consumed** (Σ live `expense_splits` rows),
      **expenseContribution = paid − consumed**, **sent** and **received** (live settlement rows),
      and **currentNet = expenseContribution + sent − received**. `expenseContribution` describes
      the paired bars; `currentNet` is the settlement-aware position. They must never both be
      called simply "net" in the API or UI
- [ ] **`Σ paid == Σ consumed == Σ expense totals` for the group, per currency** — assert it
      server-side before responding and throw if it fails, exactly as the balances endpoint asserts
      `Σ net == 0`. That assertion is the canary; a plausible-looking wrong number is the failure
      mode this whole app is designed against
- [ ] **`Σ currentNet == 0` per currency** is asserted server-side, and every member's
      `currentNet` agrees exactly with the balances endpoint for the same ledger and currency.
      The UI labels it as the current balance and explicitly says it includes recorded payments;
      the paired bars and `expenseContribution` intentionally do not
- [ ] With a display currency pinned, use T054's conversion order: convert and re-apportion every
      expense before accumulating payer/split fields, and convert each settlement before accumulating
      `sent`/`received`. Never convert an already-netted member total — rounding would make
      `currentNet` diverge from balances
- [ ] Paired bars per member (paid vs. consumed), sharing one scale so the two are comparable at a
      glance. Labelled, valued as text, **never distinguished by colour alone**
- [ ] Uses `--credit` / `--debit` only for the *net* figure, with a sign and a word alongside —
      and never `--destructive` for a debit amount (design-system.md is explicit: it fails AA as
      body text)
- [ ] One block per currency, never summed across them. Converted figures labelled as converted
      when a display currency is pinned
- [ ] A current member with no expense or settlement activity renders honestly as zero, not as an
      absent row — "Ana hasn't paid for anything" is information. A removed member with historical
      rows follows the balances endpoint's member set and remains visible
- [ ] Tests: the paid/consumed/total identity over a random ledger (extend the property harness in
      `src/lib/money/__tests__/` rather than writing a one-off); a settled case where
      `expenseContribution` differs from `currentNet` and the latter matches balances; the
      `Σ currentNet == 0` assertion; a multi-payer expense attributing correctly to each payer; a
      loan-strategy expense; a multi-currency group; and a pinned, rounding-sensitive group that
      agrees with T054's converted balances

## Out of scope

- Changing the balance engine or `src/lib/money/balances.ts`. This is a read-side view over
  existing math — if it disagrees with the engine, the view is wrong
- Per-category breakdown per member. Combinatorially messy on a phone; revisit only if asked for
- Anything that writes

## Files likely touched

```
src/server/services/insights.ts
src/app/_ui/charts/PairedBars.tsx
src/app/(app)/g/[groupId]/insights/_components/MemberBreakdown.tsx
src/lib/money/__tests__/properties.test.ts
src/lib/i18n/es.ts
docs/context/api-contract.md
```
