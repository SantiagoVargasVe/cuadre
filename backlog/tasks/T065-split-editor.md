---
id: T065
title: The split editor — all six strategies
epic: E7-frontend
status: done
depends_on: [T064, T031]
size: L
---

## Context

The only screen in this app where the UI has to understand the domain model rather than just
render it. It is also the natural test of the 100-line rule: this is **not** one large component
with a `switch`.

Read [splitting.md](../../docs/context/splitting.md) § 3 and
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The split editor*. Both mandatory.

## Acceptance criteria

- [x] One shared shell plus **one small component per strategy, each in its own file with its own
      test.** The shell owns the live total and the save gate; each strategy owns its inputs
- [x] The six strategies per the API contract:
      - `equal` / `equal_subset` — member checkboxes; all checked means `equal`
      - `shares` — a stepper per member
      - `percentage` — a percent field per member, **held as basis points**, integers
      - `exact` — a `<MoneyField>` per member
      - `loan` — pick one beneficiary
- [x] **A running remainder is always visible** — "Faltan $ 4.200" / "Sobran $ 1.100" — live, not a
      validation error on submit
- [x] **Save is disabled until the split balances exactly.** The API rejects it anyway; the point
      is the user never gets that far
- [x] **Resolved per-member amounts are always shown, including for `equal`.** Someone splitting
      `100.000` three ways sees `33.333 / 33.334 / 33.333` before saving, not a stray peso later
- [x] The preview uses **`src/lib/money/apportion` — the same function the server resolves with**,
      seeded with the same expense id where one exists. The preview must be byte-identical to what
      gets stored
- [x] Switching strategies **keeps the member selection** and re-derives amounts. Losing a
      seven-person selection because someone tapped "percentage" is unforgivable
- [x] Percentages never round-trip through a float
- [x] Every amount has an accessible label naming whose it is
- [x] Tests, one per strategy: the produced payload matches the API contract; the live remainder is
      correct mid-edit; the preview matches the server's resolution for the `100.000` three-way
      case; switching strategies preserves selection

## Out of scope

The rest of the expense form (T064). Editing an existing expense reuses this component unchanged.

## Files likely touched

```
src/app/g/[groupId]/_components/split-editor/{index,equal,shares,percentage,exact,loan}.tsx
src/app/g/[groupId]/_components/split-editor/*.test.tsx
```
