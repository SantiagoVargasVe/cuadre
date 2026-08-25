---
id: T004
title: Base UI primitives, tokens, dark mode, TanStack Query client
epic: E1-foundation
status: done
depends_on: [T001]
size: M
---

## Context

The component and data-fetching foundation every E7 task builds on. Establishing the composition
patterns now is what keeps the 100-line limit from feeling arbitrary later.

Read [design-system.md](../../docs/frontend/design-system.md) in full first.

## Acceptance criteria

- [x] `@base-ui-components/react` installed. **Not shadcn, not Radix** — if you're porting a
      snippet that imports `@radix-ui/*`, convert it
- [x] **The theme already exists** at `src/app/globals.css`, including the `--credit`,
      `--debit` and `--settled` money tokens. Consume it; don't rewrite it
- [x] Dark mode is **class-driven** (`.dark` on an ancestor) and nothing sets that class yet.
      Wire `next-themes` with `attribute="class"`, `defaultTheme="system"`, and
      `suppressHydrationWarning` on `<html>` — without it the first paint flashes the wrong
      theme. Dark is not an afterthought; half of expense-adding happens at night in a restaurant
- [x] Components use `text-credit` / `text-debit` / `text-settled`, never `text-destructive`,
      for amounts. `--destructive` fails AA as body text (3.57:1 light) — see
      [design-system.md](../../docs/frontend/design-system.md) § *Tokens*
- [x] Wrapped primitives, one per file: `Button`, `Dialog`, `Select`, `Checkbox`, `RadioGroup`,
      `Switch`, `Tabs`, `Toast`, `NumberField`
- [x] `Dialog` renders as a **full-screen sheet below 768px**. Every modal in this app is used
      one-handed on a phone
- [x] `cn()` helper (`clsx` + `tailwind-merge`)
- [x] A single `apiFetch` client that understands the error envelope from
      [api-contract.md](../../docs/context/api-contract.md) and throws typed errors carrying
      `code` and `details` — the split editor renders `details.difference` live, so it cannot be
      swallowed into a string
- [x] TanStack Query provider with array query keys scoped by group
- [x] Tests: `apiFetch` maps each error shape to its typed error; `cn` merges conflicting classes

## Out of scope

`<Money>` and `<MoneyField>` (T061 — they need the money primitives from T030). Any page.

## Files likely touched

```
src/app/_ui/*.tsx
src/app/globals.css
src/lib/api/{client,errors}.ts
src/lib/cn.ts
src/app/providers.tsx
```
