---
id: T082
title: Per-member breakdown — what they paid for vs. what they consumed
epic: E9-insights
status: todo
depends_on: [T081]
size: M
---

## Context

The balances view answers "what is my net". This answers the two numbers underneath it: **what I
put in** (my payer rows) and **what I got** (my split rows). Those two are what people actually
argue about, and net alone hides both — someone who paid 2.000.000 and consumed 1.900.000 has a
small net and a large involvement, and the difference is the whole story of a trip.

Builds directly on the aggregates and the SVG primitives T081 creates. **Do not fork the chart
components.**

Read [splitting.md](../../docs/context/splitting.md) — **mandatory**, this is money —
[design-system.md](../../docs/frontend/design-system.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*, and
[api-contract.md](../../docs/context/api-contract.md).

## Acceptance criteria

- [ ] Per member, per currency: **paid** (Σ their `expense_payers` rows), **consumed** (Σ their
      `expense_splits` rows), and the net between them. Extends T081's insights service rather than
      adding a second endpoint
- [ ] **`Σ paid == Σ consumed == Σ expense totals` for the group, per currency** — assert it
      server-side before responding and throw if it fails, exactly as the balances endpoint asserts
      `Σ net == 0`. That assertion is the canary; a plausible-looking wrong number is the failure
      mode this whole app is designed against
- [ ] The net shown here **agrees with the balances endpoint** for the same member and currency,
      settlements included or excluded consistently — and the task states which, visibly, in the UI
      copy. Two screens disagreeing about one person's net is worse than either being absent
- [ ] Paired bars per member (paid vs. consumed), sharing one scale so the two are comparable at a
      glance. Labelled, valued as text, **never distinguished by colour alone**
- [ ] Uses `--credit` / `--debit` only for the *net* figure, with a sign and a word alongside —
      and never `--destructive` for a debit amount (design-system.md is explicit: it fails AA as
      body text)
- [ ] One block per currency, never summed across them. Converted figures labelled as converted
      when a display currency is pinned
- [ ] A member with no activity renders honestly as zero, not as an absent row — "Ana hasn't paid
      for anything" is information
- [ ] Tests: the paid/consumed/total identity over a random ledger (extend the property harness in
      `src/lib/money/__tests__/` rather than writing a one-off), agreement with the balances
      endpoint, a multi-payer expense attributing correctly to each payer, a loan-strategy expense,
      and a multi-currency group

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
