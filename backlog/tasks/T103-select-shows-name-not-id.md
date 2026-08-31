---
id: T103
title: The settle-up recipient select shows a UUID instead of the member's name
epic: E12-first-use
status: todo
depends_on: []
size: S
---

## Context

In "Registrar pago", the *¿A quién le pagaste?* select displays the recipient's raw UUID once
chosen, not their name. The dropdown lists names correctly; it's the closed trigger that's wrong.

**Cause, verified:** `SelectValue` (Base UI `1.7.0`, `Select.Value`) renders the selected
*value*. In `SettlementForm` the item's value is `m.userId` and its child is `m.displayName`, so
the trigger renders the id. `CreateGroupDialog`'s currency select looks fine only by accident —
there the value *is* the label (`"COP"`).

Trivial to fix and worth fixing properly: the same trap is waiting for every future select whose
value isn't its label.

Read [design-system.md](../../docs/frontend/design-system.md) § *Component library*.

## Acceptance criteria

- [ ] The closed select shows the member's **display name**; the dropdown is unchanged
- [ ] Fixed with Base UI's own supported mechanism — check the installed `@base-ui/react@1.7.0`
      API for `items` on `Select.Root` or a render/children function on `Select.Value` — rather
      than a hand-rolled `find()` in each consumer. Don't fight the library
      (design-system.md: "Base UI handles [...] don't reimplement it, don't fight it")
- [ ] If the fix belongs in the shared wrapper, it goes in `src/app/_ui/Select.tsx` so every
      select gets it
- [ ] **Audit the other selects** — currency in `CreateGroupDialog`, currency in
      `AmountCurrencyFields`, the loan beneficiary in the split editor, and whatever
      [T104](T104-settle-up-any-currency.md) adds. Any whose value ≠ label has the same bug
- [ ] **No UUID is ever rendered as user-facing text anywhere.** Grep the app for other places a
      raw id could reach the screen and fix or file them
- [ ] Test: with a recipient selected, the trigger's text is the display name and does **not**
      match a UUID pattern

## Out of scope

Adding a currency select to the settle-up form — that's [T104](T104-settle-up-any-currency.md),
which builds on this fix rather than duplicating it.

## Files likely touched

```
src/app/_ui/Select.tsx
src/app/(app)/g/[groupId]/_components/SettlementForm.tsx
```
