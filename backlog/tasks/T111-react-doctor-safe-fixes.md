---
id: T111
title: React Doctor pass — the safe subset, and the list of verified non-issues
epic: E13-code-health
status: done
depends_on: []
size: M
---

## Context

`npx react-doctor@latest` was run over `main` on 2026-09-01: 67 findings across 20 rules. Most
do not apply to this codebase and are enumerated under **Out of scope** with the reason each was
dismissed — that list is half the point of this task, so nobody re-triages the same 60 warnings
next quarter.

What is left is small and real: a deprecated Zod form, two plain `<a>` tags, some dead exports,
and three service reads that genuinely are independent of each other. Do those.

The raw output is not committed (it lived in a `/tmp` dir). Re-run `npx react-doctor@latest
--verbose` from the repo root to regenerate it.

Read before starting:
- [security.md](../../docs/context/security.md) § *Non-membership is 404* — the await-ordering
  constraint that decides which of the `Promise.all` findings are safe
- [design-system.md](../../docs/frontend/design-system.md) — for the component-file changes
- Zod 4 string-format docs — `z.email()` / `z.uuid()` / `z.url()` / `z.iso.datetime()`

## Acceptance criteria

- [ ] **Zod 4 string formats.** Replace the deprecated `z.string().<format>()` calls with the
      top-level form, preserving each error-message argument:
      - `src/lib/schemas/auth.ts` — `z.string().email(v.emailInvalid)` ×2 → `z.email(v.emailInvalid)`
      - `src/lib/schemas/expenses.ts` — `z.string().uuid()` → `z.uuid()`
      - `src/lib/schemas/settlements.ts` — `z.string().uuid()` → `z.uuid()`
      - `src/lib/schemas/invites.ts` — `z.string().datetime()` → `z.iso.datetime()`
      - `src/server/config.schema.ts` — `z.string().url(...)` ×2 → `z.url(...)`; the trailing
        `.refine(...)` / `.startsWith(...)` chains stay as-is
      `.regex(...)` / `.min(...)` calls are **not** this rule — leave every one of them.
      `config.schema.ts` is imported outside Next by `drizzle.config.ts`, so no new import may
      be added — `z.url` is core Zod, this is fine.
- [ ] **`next/link` on the auth pages.** `src/app/(auth)/login/LoginForm.tsx` and
      `src/app/(auth)/register/RegisterForm.tsx` link to each other with a plain `<a>`, which
      full-reloads. Swap for `next/link`.
- [ ] **Dead exports.** Drop the `export` (keep the declarations):
      - `src/app/_ui/Tabs.tsx` — `TabPanel`
      - `src/app/(app)/g/[groupId]/_components/split-editor/resolve.ts` — remove
        `EmptyApportionmentError` and `NonPositiveWeightError` from the re-export block; the
        other two names in that block stay
      - `src/app/_ui/Dialog.tsx` — `DialogDescription`: **do not just delete it.** Either wire it
        into `DialogContent` so dialogs get an `aria-describedby`, or delete it if descriptions
        are confirmed unused. State which, and why, in the PR.
- [ ] **`SettlementAmountFields.tsx` — reformat on currency change without an effect.** Move the
      `setValue("amount", formatAmountInput(...))` out of the `useEffect` and into the currency
      `<Select>`'s `onValueChange`; delete the `firstRun` ref. Behaviour is unchanged — switching
      currency still reformats the typed amount under the new decimal rules — and the existing
      tests still pass.
- [ ] **`ExpenseForm.tsx` — `split` need not be state** *(only if it doesn't cost readability)*.
      `split` is written by `SplitEditor`'s `onChange` and read only in `onSubmit`, never in
      render, so it can be a `useRef`. But `payers` and `category` are both `useState` and both
      render-read; if a lone `splitRef` reads worse than the symmetry is worth, leave it and say
      so. Not a blocker for this task.
- [ ] **Parallelise the three service reads that are actually independent** — and only the reads
      that run *after* the membership gate:
      - `src/server/services/groups.ts` `getGroupDetail` — the `group` select and the
        `memberRows` select
      - `src/server/services/fx.ts` `getDisplayCurrency` — the `group` select and the `pinRows`
        select
      - `src/server/services/insights.ts` `getInsights` — fold the `group` select into the
        `Promise.all` that already batches the other three reads
      Do **not** reorder `requireMembership` / `assertGroupNotArchived` relative to anything.
      Do **not** touch `exportExpensesCsv` — its first `await` (`listAllExpensesForExport`) *is*
      the membership check, and the comment says so; racing the title read against it would leak.
      Do **not** touch the route-handler `await context.params` + `await requireUserId` pairs —
      `params` is already resolved and `requireUserId` is synchronous crypto, so `Promise.all`
      buys nothing there.
- [ ] `npm run test:ci` is green — lint, typecheck, test + coverage, build. No coverage
      regression in `src/lib/money/**` (95%) or `src/server/services/**` (80%).

## Out of scope

Everything below was checked and is deliberately **not** being changed. Do not "fix" these.

- **`AvatarEditor.tsx:34` (`rendering-hydration-no-flicker`)** and **`ThemeToggle.tsx:20`
  (`no-initialize-state`)** — intended. The value is either non-deterministic (`nanoid`) or
  server-unavailable (`next-themes` `resolvedTheme`); producing it during render is precisely the
  hydration mismatch the mount effect exists to avoid. Both are commented in place.
  `useSyncExternalStore` is not exposed by `next-themes`.
- **`ExpenseRow.tsx:31` — `members = []` "breaks memo"** — nothing in `src/app` is wrapped in
  `React.memo`, and the only non-test caller always passes `members`. Hoisting a
  `const NO_MEMBERS: GroupMember[] = []` is harmless but fixes nothing; skip unless you're in
  the file anyway.
- **`JoinAccept.tsx:32` (`no-loading-flag-reset-outside-finally`)** — false positive. The reset
  *is* in the `catch`; the success and `ALREADY_A_MEMBER` paths keep `pending` truthy on purpose
  because they `router.push` away.
- **`InvitePanel.tsx:15` (`query-mutation-missing-invalidation`)** — false positive. The
  component has no dependent `useQuery`; `mint.data` is rendered directly.
- **`format.ts:62,66,70,132` (`no-non-null-assertion-on-maybe-undefined-result`)** — effectively
  a false positive. All four are module-load-time constants derived from hardcoded literal inputs
  (`formatToParts(1.1)` / `(1)` / `(-1)` / `(1000)`) against one fixed locale, where the sought
  part is guaranteed. They would throw at import in every test run, not in production. Adding a
  fallback would reintroduce the very separator glyphs the file deliberately refuses to hardcode.
- **`RevisionEntry.tsx:27`, `HiddenDataTable.tsx:34` (`no-array-index-as-key`)** — static lists
  that never reorder or filter; the composite key is stable. Not a bug.
- **`js-combine-iterations` ×5, `async-await-in-loop` ×3** — two-pass `.filter().map()` over
  arrays of group-size (2–15), and per-currency `await`s in a once-a-day FX cron. Style, not
  measurable performance; the codebase prefers the readable chain. Revisit only if a hot,
  large-array path shows up.
- **`Select.tsx:24`, `Toast.tsx:8` (`only-export-components`)** — Fast-Refresh DX only, no
  runtime effect. Optional; skip if relocating `toastManager` ripples through imports.
- **`SplitEditor.tsx:36` (`no-pass-*-to-parent`, `no-prop-callback-in-effect`)** — real, but a
  money-path refactor with its own risk profile. It is **T112**, not this task.
- The ~24 route-handler `server-sequential-independent-await` hits — see the last bullet of the
  acceptance criteria.

## Files likely touched

```
src/lib/schemas/auth.ts
src/lib/schemas/expenses.ts
src/lib/schemas/invites.ts
src/lib/schemas/settlements.ts
src/server/config.schema.ts
src/app/(auth)/login/LoginForm.tsx
src/app/(auth)/register/RegisterForm.tsx
src/app/_ui/Tabs.tsx
src/app/_ui/Dialog.tsx
src/app/(app)/g/[groupId]/_components/split-editor/resolve.ts
src/app/(app)/g/[groupId]/_components/SettlementAmountFields.tsx
src/app/(app)/g/[groupId]/_components/ExpenseForm.tsx
src/server/services/groups.ts
src/server/services/fx.ts
src/server/services/insights.ts
```
