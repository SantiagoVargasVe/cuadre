---
id: T102
title: Make an expense's split breakdown discoverable
epic: E12-first-use
status: done
depends_on: [T100]
size: S
---

## Context

"I'd like to click an expense and see how it's divided between the group."

**That already works** — and that is the finding. `ExpenseRow` is a `DialogTrigger` wrapping a
`<button>`; tapping it opens `ExpenseDetail`, which lists every payer and every split with
amounts, from arrays the list endpoint already returned (no second fetch). A real user of the
deployed app did not discover it.

So this task is affordance, not feature. The row looks like a static card: no pointer cursor
(Tailwind v4 dropped it — [T100](T100-pointer-cursors.md)), no hover state, no chevron, nothing
that says "there is more behind this".

While in there, one genuine gap: `expense.strategy` is on the wire and rendered nowhere, so the
detail shows *what* each person owes but never *why* — "en partes iguales" vs "por porcentaje"
vs "montos exactos" is exactly the question someone opens this dialog to answer.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The expense form* and
[design-system.md](../../docs/frontend/design-system.md).

## Acceptance criteria

- [x] An expense row is **visibly tappable** — restructured to a `group` row with a persistent
      right-edge chevron (`svg[aria-hidden]` that nudges on `group-hover`), `hover:border-ring
      hover:bg-muted/40`, `active:bg-muted`, and `cursor: pointer` from T100. The chevron is the
      affordance at 375px, verified in-browser (light + dark)
- [x] `aria-haspopup="dialog"` comes from Base UI's `DialogTrigger`; the button's text leads with
      the title, so its accessible name is `"Hotel Cartagena US$ 90,00 …"`, not `"button"` —
      asserted with `toHaveAccessibleName`
- [x] The dialog states **how it was divided** under "Dividido entre" — `strategyPhrase.ts` maps
      `expense.strategy` → `es.expenseFeed.strategy.*`: "En partes iguales entre N personas"
      (covers `equal` + `equal_subset`), "Por participaciones", "Por porcentaje", "Montos
      exactos", "Préstamo a {name}", plus an `unknown` fallback. All i18n
- [x] Split rows still show member + amount, unchanged — `PartyRow` is untouched
- [x] **No second fetch** — `ExpenseDetail` takes the row's complete `payers`/`splits` arrays;
      the "opens with no network request" test stubs `fetch` and asserts 0 calls
- [x] Dialog amounts carry currency (US$/€/$ via T101) and a converted total keeps its
      "Monto convertido" marker — existing `ExpenseDetail.test.tsx` converted case still green
- [x] Tests: `strategyPhrase.test.ts` covers all six strategies + the singular/fallback cases;
      `ExpenseDetail.test.tsx` renders a phrase for each of the six; `ExpenseRow.detail.test.tsx`
      asserts `aria-haspopup` + no network on open

## Out of scope

Editing or deleting from the dialog. The revision-history diff — that's `T083`, post-MVP, and it
needs its own design.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/ExpenseRow.tsx
src/app/(app)/g/[groupId]/_components/ExpenseDetail.tsx
src/lib/i18n/es.ts
```
