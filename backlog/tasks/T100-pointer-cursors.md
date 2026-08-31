---
id: T100
title: Restore pointer cursors on every interactive control
epic: E12-first-use
status: todo
depends_on: []
size: S
---

## Context

Nothing in this app shows a pointer cursor. Buttons, tabs, switches, checkboxes, select
triggers and the tappable expense row all render with the default arrow, so on desktop nothing
reads as clickable.

**Cause, verified:** Tailwind v4 (this repo is on `4.3.3`) removed the Preflight rule that gave
`button` and `[role="button"]` `cursor: pointer` — v4 sets `cursor: default` instead, and expects
the application to opt back in. Nothing in this repo opts back in: the only `cursor` declaration
anywhere in `src/` is `cursor-default` on `SelectItem`.

This is small but it is not cosmetic. It is the most likely reason nobody discovered that an
expense row opens its split breakdown ([T102](T102-expense-detail-discoverable.md)) — the row is
a `<button>` that looks like a static card.

Read [design-system.md](../../docs/frontend/design-system.md) § *Component rules*.

## Acceptance criteria

- [ ] Every interactive control shows `cursor: pointer` on hover: `Button` (all variants and
      sizes), `DialogTrigger` / `DialogClose`, `Tab`, `Switch`, `Checkbox`, `RadioGroup` items,
      `SelectTrigger` and `SelectItem`, `TooltipTrigger`, the expense-row trigger, the
      add-expense FAB, and any `<label>` that toggles a control
- [ ] **Fixed once, centrally** — a base-layer rule in `globals.css` or the shared primitives in
      `src/app/_ui/`. Do **not** sprinkle `cursor-pointer` onto individual call sites; the next
      component added would just miss it again
- [ ] **A disabled control never shows a pointer.** `Button` already carries
      `disabled:pointer-events-none`; verify the same holds for every other primitive, including
      Base UI's `data-disabled` state, and fix whatever doesn't
- [ ] Text inputs keep their text caret and non-interactive text stays `default` — this is not a
      blanket `cursor: pointer` on everything
- [ ] `SelectItem`'s existing `cursor-default` is either justified in a comment or changed; right
      now it is the one place that deliberately opts out and it reads as an oversight
- [ ] A note in [design-system.md](../../docs/frontend/design-system.md) recording that Tailwind
      v4 does not do this for us, so the next person doesn't delete the rule as redundant
- [ ] Verified by hand at 1280px in both themes

## Out of scope

Hover/active *colour* states, focus rings, and touch-target sizing. Those are already specified
and are not what's broken here.

## Files likely touched

```
src/app/globals.css
src/app/_ui/*.tsx
docs/frontend/design-system.md
```
