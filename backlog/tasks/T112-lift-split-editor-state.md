---
id: T112
title: Lift the split-editor's state into the expense form
epic: E13-code-health
status: done
depends_on: []
size: M
---

## Context

`react-doctor` flags `SplitEditor` three times on one line
(`no-pass-live-state-to-parent`, `no-prop-callback-in-effect`, `no-pass-data-to-parent`):
it owns its split state via `useSplitEditorState`, then mirrors that state up to `ExpenseForm`
by calling the `onChange` prop inside a `useEffect`. It works — there is a
`JSON.stringify(c.splitInput)` effect dependency and an `eslint-disable react-hooks/exhaustive-deps`
holding it together — but it is the "notifying the parent about state changes" anti-pattern from
React's *You Might Not Need an Effect*, and the `stringify`-as-dependency is fragile.

The fix is to make `ExpenseForm` (or a hook it owns) the single owner of the split state and
delete the mirror. `c.splitInput` and `c.preview` are already computed synchronously during
render, so the parent can read them directly — no effect required.

Kept out of T111 on purpose: this touches the money path and a large test surface (the split
editor is T065, and T110 added the six-strategy edit round-trip).

Read before starting:
- [splitting.md](../../docs/context/splitting.md) — **mandatory**, this is the split editor
- [design-system.md](../../docs/frontend/design-system.md) and
  `docs/frontend/CLAUDE.md` § *The expense form*
- The current `useSplitEditorState`, `SplitEditor`, `ExpenseForm`, `EditExpenseDialog`, and
  their tests

## Acceptance criteria

- [ ] `useSplitEditorState` is called once, in `ExpenseForm` (or a `useExpenseForm` hook it
      owns) — not inside `SplitEditor`.
- [ ] `SplitEditor` is presentational: it receives the controller (or the exact slice it needs)
      as props. No `useEffect`, no `onChange` prop, no `JSON.stringify` dependency, no
      `eslint-disable` anywhere in the file.
- [ ] `ExpenseForm` derives `split` and split-validity straight from the controller during
      render (`c.splitInput`, `c.preview !== null`). The `split` / `splitValid` `useState` pair
      and the value they mirrored are gone.
- [ ] Both entry paths still work:
      - **create** — `SplitEditor` opens on `equal` among everyone; all six strategies submit
      - **edit** (`EditExpenseDialog` → `ExpenseForm` with `expense`) — `expense.split` seeds the
        controller; all six strategies round-trip unchanged, matching T110's existing suite
- [ ] The live per-member preview still updates on every keystroke, and `canSubmit` still
      reflects split validity synchronously (no one-render lag on the save button).
- [ ] Tests updated for the new prop shape: `SplitEditor.test.tsx`, `ExpenseForm.test.tsx`, and
      T110's edit round-trip stay green. No new `eslint-disable`.
- [ ] `npm run test:ci` green; no coverage regression.

## Out of scope

- The money math — nothing in `src/lib/money/**` changes.
- `PayerEditor` — its `value` / `onChange` is ordinary controlled state, not an effect mirror.
  Leave it.
- Everything in T111.
- Introducing a state-management library or a global store. If a shared boundary is needed, a
  local hook or plain prop-drilling from `ExpenseForm` is the expected shape.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/split-editor/SplitEditor.tsx
src/app/(app)/g/[groupId]/_components/split-editor/useSplitEditorState.ts
src/app/(app)/g/[groupId]/_components/split-editor/StrategyPanel.tsx
src/app/(app)/g/[groupId]/_components/ExpenseForm.tsx
src/app/(app)/g/[groupId]/_components/EditExpenseDialog.tsx
src/app/(app)/g/[groupId]/_components/split-editor/SplitEditor.test.tsx
src/app/(app)/g/[groupId]/_components/ExpenseForm.test.tsx
```
