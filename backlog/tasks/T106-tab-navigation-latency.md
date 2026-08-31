---
id: T106
title: Kill the delay when switching group tabs
epic: E12-first-use
status: done
depends_on: []
size: M
---

## Context

Switching between Gastos, Balances and Ajustes has a visible pause with no feedback — the old tab
stays on screen, then the new one appears. Four causes, all verified in the code:

1. **No prefetch.** `GroupTabs` navigates with `router.push()` inside Base UI's `onValueChange`.
   There is no `<Link>`, so Next never prefetches the sibling tabs — every switch starts cold.
2. **No `loading.tsx` anywhere in `src/app/`.** With nothing to stream, Next holds the old route
   on screen until the new page has fully awaited its data. The pause *is* the fetch, with no
   skeleton and no pending state.
3. **Every tab refetches the same two things.** Each page does 3–4 `apiFetchServer` calls, and
   all three tabs call `GET /api/groups/:id` **and** `GET /api/auth/me`. Each of those is a real
   loopback HTTP round trip that re-verifies the JWT and re-queries Postgres — work repeated on
   every tab switch and duplicated within a single render.
4. **The layout fetches the group again on the client.** `GroupHeading` runs its own TanStack
   query for `["group", groupId]` on top of the server fetches.

The shell — heading and tab bar — is identical across all three tabs and could paint instantly.
Today it doesn't.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Server vs client components* and
§ *Data loading*, and [architecture.md](../../docs/context/architecture.md) § *Internal boundary*.

## Acceptance criteria

- [x] **The tab bar and group heading stay on screen and respond immediately** on tab change; the
      panel below shows a pending state — verified: on a Balances click the `<h1>` and `[role=tab]`
      bar never unmount and a 4-card `.animate-pulse` skeleton renders before the balances content
- [x] Tab navigation prefetches siblings — `GroupTabs` calls `router.prefetch()` for all three
      routes on mount (dev throttles prefetch; a prod build issues `/g/:id/balances?_rsc=` and
      `/g/:id/ajustes?_rsc=` on load, verified). Base UI `Tabs` is untouched — `router.push` still
      drives the nav, so keyboard/ARIA, refresh and the back button all keep working
- [x] **`loading.tsx`** at `(app)/g/[groupId]/` — a skeleton of four content-shaped cards, not a
      spinner. It wraps only the tab `page`; the layout (heading + tab bar) sits outside the
      boundary and stays painted
- [x] **Per-request duplication gone.** `getGroupDetail` / `getMe` in `_data.ts` are
      `React.cache`d; the layout resolves both once, the pages get cache hits. A single tab
      render makes `GET /api/groups/:id` and `GET /api/auth/me` once each (measured in the dev
      server log)
- [x] `GroupHeading` is now a plain server component taking `title` — its client `useQuery` for
      `["group", groupId]` is gone. Measured: the Gastos page made 2 client `/api/` requests
      before (`me` + `groups/:id`), 1 after (`me`)
- [x] **`cache: "no-store"` stays** — `apiFetchServer` is unchanged; `React.cache` dedupes within
      one request only, it does not persist one member's data into another's response
- [x] FE/BE boundary holds — `src/app/` still only calls Route Handlers; no `src/server/` or
      Drizzle import. The remaining per-tab cost is the loopback round trips (JWT verify + PG
      query per call); that's inherent to the monolith's internal-HTTP boundary and not widened
      here. Filed as a follow-up note in the PR rather than reached past
- [x] **Measured, before/after** — table in the PR: client `/api/` calls per tab page 2→1,
      redundant `GET /api/groups/:id` per screen 2→1, sibling prefetch none→2, `loading.tsx`
      none→skeleton
- [x] Balances still read only from `GET /api/groups/:id/balances` — `balances/page.tsx` is
      unchanged except for swapping its inline group/me fetches for the shared loaders

## Out of scope

Caching or denormalizing balances — architecture.md is explicit that a cached balances table that
can disagree with the ledger is the bug this design exists to prevent. Pagination of the expense
feed. Any change to what the endpoints return.

## Files likely touched

```
src/app/_shell/GroupTabs.tsx
src/app/_shell/GroupHeading.tsx
src/app/(app)/g/[groupId]/layout.tsx
src/app/(app)/g/[groupId]/loading.tsx          (new)
src/app/(app)/g/[groupId]/{page,balances/page,ajustes/page}.tsx
src/lib/api/server.ts
```
