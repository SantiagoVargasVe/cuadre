---
id: T102
title: Make an expense's split breakdown discoverable
epic: E12-first-use
status: todo
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

- [ ] An expense row is **visibly tappable**: hover/active state, a chevron or equivalent
      affordance, and `cursor: pointer` (from T100). At 375px, where there is no hover, the
      affordance must still be visible
- [ ] The trigger announces itself — `aria-haspopup="dialog"` and an accessible name that names
      the expense, not a bare "button"
- [ ] The detail dialog states **how the expense was divided**, in words, from
      `expense.strategy` — e.g. "En partes iguales entre 4 personas", "Por porcentaje",
      "Montos exactos", "Préstamo a Ana". Spanish, through i18n keys, never a hardcoded string
- [ ] Each split row shows the member and their amount (already true) — keep the accessible label
      naming *whose* amount it is, per design-system.md § *Accessibility*
- [ ] Still **no second fetch** on open. The payers/splits arrays on the row are complete; a
      per-expense request would fan the feed out into N+1
- [ ] Amounts in the dialog carry their currency ([T101](T101-currency-on-every-amount.md)) and,
      when the group is converted, stay marked as converted with the pin reachable
- [ ] Test: the strategy phrase renders for each of the six strategies; opening the dialog issues
      no network request

## Out of scope

Editing or deleting from the dialog. The revision-history diff — that's `T083`, post-MVP, and it
needs its own design.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/ExpenseRow.tsx
src/app/(app)/g/[groupId]/_components/ExpenseDetail.tsx
src/lib/i18n/es.ts
```
