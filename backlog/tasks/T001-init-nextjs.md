---
id: T001
title: Initialize Next.js 15 + TypeScript + Tailwind + Vitest
epic: E1-foundation
status: todo
depends_on: []
size: M
---

## Context

The empty repo. Everything else depends on this, and the shape it lands in is assumed by every
other doc — particularly the `src/app` / `src/server` / `src/lib` split, which is the boundary
that keeps frontend and backend context separable.

Read [architecture.md](../../docs/context/architecture.md) § *Internal boundary* before creating
directories.

## Acceptance criteria

- [ ] Next.js 15 App Router, TypeScript strict, React 19
- [ ] Tailwind v4. **The theme is already committed** at `src/app/globals.css` — do not
      regenerate or replace it. Wire Tailwind to it and leave the tokens alone; the palette and
      its measured contrast are documented in
      [design-system.md](../../docs/frontend/design-system.md) § *Tokens*
- [ ] `src/app/fonts.ts` is committed too — apply `fontVariables` to `<html>` in the root layout
- [ ] No hardcoded colours anywhere, ever
- [ ] Directory skeleton exactly as `architecture.md` specifies:
      `src/app/`, `src/server/`, `src/lib/money/`, `src/lib/i18n/`
- [ ] ESLint with **`max-lines: 100`** on `src/app/**` components — the composition forcing
      function from [design-system.md](../../docs/frontend/design-system.md)
- [ ] **A lint rule forbidding `src/app/**` from importing `src/server/**` or `drizzle-orm`.**
      The boundary is a convention, so it needs enforcing or it decays. `no-restricted-imports`
      with a message pointing at the ADR
- [ ] Vitest configured with two projects: a `node` environment for `src/server` and `src/lib`,
      and `jsdom` + React Testing Library for `src/app`
- [ ] Coverage thresholds wired but not yet gating paths that don't exist:
      `src/lib/money/**` 95%, `src/server/services/**` 80%
- [ ] Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:ci`. `test:ci` runs all four
      exactly as CI will, coverage included
- [ ] `npm run test:ci` passes on the empty project

## Out of scope

Postgres (T002), Drizzle (T003), any UI component (T004), any route beyond the default page.

## Files likely touched

```
package.json
tsconfig.json
next.config.ts
eslint.config.mjs
vitest.config.ts
src/app/{layout,page}.tsx
src/app/globals.css
```
