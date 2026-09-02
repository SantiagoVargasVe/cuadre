---
id: T110
title: Edit and delete expenses from the expense detail
epic: E12-first-use
status: done
depends_on: [T035, T063, T064, T065]
size: M
---

## Context

The ledger API has supported versioned edits and soft deletes since T035, but the expense detail
has no controls that let a member use either capability. A mistake made while entering a shared
expense therefore cannot be corrected from the product.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The expense form*,
[design-system.md](../../docs/frontend/design-system.md) § *Forms* and *Data*,
[splitting.md](../../docs/context/splitting.md) §3, [data-model.md](../../docs/context/data-model.md)
§ *expenses* and *Deletion semantics*, [api-contract.md](../../docs/context/api-contract.md)
§ *Editing*, [security.md](../../docs/context/security.md) § *Known accepted risks*, and
[testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [x] Every current group member sees Editar and Eliminar in an expense's detail; neither action
      is owner-only or creator-only
- [x] Edit opens the existing expense form prefilled with the entered title, amount, currency,
      date, category, all payers, and the original split strategy inputs
- [x] The detail API exposes the stored split intent needed to round-trip equal subsets, shares,
      percentages, exact amounts, and loans without changing the list endpoint or adding an N+1
- [x] Save sends a full-replacement `PATCH /api/expenses/:id`, never applies an optimistic expense
      update, and refreshes the row from the server's resolved response
- [x] A title-only edit keeps the existing expense id as the apportionment seed and preserves the
      split strategy, members, payer amounts, and remainder assignment
- [x] Delete requires a destructive confirmation that names the expense, calls
      `DELETE /api/expenses/:id`, and removes the row only after the server succeeds
- [x] Successful edits and deletes invalidate the group's expense and balance query keys; failures
      leave the row visible and show a Spanish error
- [x] The detail dialog closes after either successful action and the empty state appears when the
      last expense is deleted
- [x] Tests cover split-intent serialization, a prefilled full-replacement edit, invalidations,
      successful deletion, and failed deletion retaining the row
- [x] `npm run test:ci` passes, and the flow is exercised in the running app at a phone-sized
      viewport

## Out of scope

Revision-history changes (T083 already owns the diff viewer). Restoring a deleted expense. Bulk
editing or deleting. Changing the backend's existing any-member authorization rule.

## Files likely touched

```
src/server/services/expenses.ts
src/app/(app)/g/[groupId]/_components/ExpenseForm.tsx
src/app/(app)/g/[groupId]/_components/ExpenseRow.tsx
src/app/(app)/g/[groupId]/_components/ExpenseFeed.tsx
src/app/(app)/g/[groupId]/_components/split-editor/
src/lib/i18n/es.ts
```
