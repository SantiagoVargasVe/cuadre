---
id: T103
title: The settle-up recipient select shows a UUID instead of the member's name
epic: E12-first-use
status: done
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

- [x] The closed select shows the member's **display name**; the dropdown is unchanged
- [x] Fixed with Base UI's supported mechanism: the `items` map on `<Select.Root>` ("when
      specified, `<Select.Value>` renders the label of the selected item"). No hand-rolled
      `find()` — a `selectItems(list, getValue, getLabel)` helper builds the map
- [x] The reusable half lives in `src/app/_ui/Select.tsx` (`selectItems` + a doc comment on
      when a select needs it); `SettlementForm` passes `items={recipientItems}`
- [x] **Audited the other selects.** Currency in `CreateGroupDialog` and `AmountCurrencyFields`:
      value === label (`"COP"` / `"COP"`), render correctly, no change. Loan beneficiary in the
      split editor: a `RadioGroup`, not a `Select` — its items are always mounted, so the label
      always shows. (T104's currency select will use `selectItems` or, being code === label,
      won't need it.)
- [x] **No UUID rendered as user-facing text.** Grepped `src/app/**/*.tsx` for `userId` / `.id`
      reaching JSX text — every consumer maps through `nameOf` / `displayName` / a `byId` map;
      the settle-up trigger was the only leak
- [x] Test (`SettlementForm.test.tsx`): the closed trigger's text is the display name and does
      not match a UUID pattern, both for the default recipient and after picking another

## Out of scope

Adding a currency select to the settle-up form — that's [T104](T104-settle-up-any-currency.md),
which builds on this fix rather than duplicating it.

## Files likely touched

```
src/app/_ui/Select.tsx
src/app/(app)/g/[groupId]/_components/SettlementForm.tsx
```
