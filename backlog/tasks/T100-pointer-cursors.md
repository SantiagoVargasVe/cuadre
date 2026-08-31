---
id: T100
title: Restore pointer cursors on every interactive control
epic: E12-first-use
status: done
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

- [x] Every interactive control shows `cursor: pointer` on hover: `Button` (all variants and
      sizes), `DialogTrigger` / `DialogClose`, `Tab`, `Switch`, `Checkbox`, `RadioGroup` items,
      `SelectTrigger` and `SelectItem`, `TooltipTrigger`, the expense-row trigger, the
      add-expense FAB, and any `<label>` that toggles a control
      — one base-layer rule covers `button`, `a[href]`, the ARIA roles Base UI renders
      (`[role="button"|"tab"|"option"|"checkbox"|"radio"|"switch"|"menuitem…"]`), and
      `label:has(> …toggle…)`
- [x] **Fixed once, centrally** — a base-layer rule in `src/app/globals.css`. No `cursor-pointer`
      at any call site
- [x] **A disabled control never shows a pointer.** Carve-out block for `button:disabled`,
      `[data-disabled]` (Base UI sets it on every disabled primitive) and `[aria-disabled="true"]`
      (primitives that keep focus while disabled), placed after the enable rule so it wins at
      equal specificity
- [x] Text inputs keep their text caret and non-interactive text stays `default` — neither block
      targets a bare `input` or `*`; guarded by a test
- [x] `SelectItem`'s `cursor-default` removed; it now inherits the base-layer pointer via its
      `role="option"` and opts back out via `data-disabled`, with a comment saying so
- [x] Note added to [design-system.md](../../docs/frontend/design-system.md) § *Component rules*
      → "Pointer cursors are ours to supply"
- [x] Verified by hand at 1280px (and 375px) in both themes — screenshots in the PR

## Out of scope

Hover/active *colour* states, focus rings, and touch-target sizing. Those are already specified
and are not what's broken here.

## Files likely touched

```
src/app/globals.css
src/app/_ui/*.tsx
docs/frontend/design-system.md
```
