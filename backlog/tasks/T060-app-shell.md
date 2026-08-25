---
id: T060
title: App shell, layout, and i18n scaffolding
epic: E7-frontend
status: todo
depends_on: [T004, T014]
size: M
---

## Context

The frame every screen renders inside, and the i18n setup that has to exist from the first string
or retrofitting it will miss half the app.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Routes* and
[design-system.md](../../docs/frontend/design-system.md) § *Layout*.

## Acceptance criteria

- [ ] Root layout: header with the current group's name where relevant, user menu, logout
- [ ] i18n with a Spanish catalog, typed keys, and a lint-visible failure for a missing key.
      **Spanish-first** — English is a later locale, not a parallel one
- [ ] A single content column with a max width. The group feed is a **list, not a grid**
- [ ] `/g/[groupId]` renders three tabs — **Gastos · Balances · Ajustes** — with the active tab in
      the URL so a refresh and a back button both behave
- [ ] Dark mode works end to end, not just at the token level
- [ ] Toast host wired for the whole app
- [ ] Authenticated layout redirects to `/login` when there's no session, preserving the intended
      destination
- [ ] Verified at 375px, 768px, 1280px
- [ ] Tests: an unauthenticated visit redirects and returns to the destination after login; tab
      state survives a refresh

## Out of scope

Any page content (T062 onward). `<Money>` (T061).

## Files likely touched

```
src/app/layout.tsx
src/app/(app)/layout.tsx
src/app/g/[groupId]/layout.tsx
src/lib/i18n/{index,es}.ts
```
