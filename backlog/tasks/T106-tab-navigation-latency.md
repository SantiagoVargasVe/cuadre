---
id: T106
title: Kill the delay when switching group tabs
epic: E12-first-use
status: todo
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

- [ ] **The tab bar and group heading stay on screen and respond immediately** on tab change; the
      panel below shows a pending state rather than the previous tab's content
- [ ] Tab navigation goes through **`<Link>`** (or Next's `useRouter` prefetch API) so sibling
      tabs are prefetched. Base UI's `Tabs` keyboard/ARIA behaviour must survive the change — a
      tab is still a real route, so refresh and the back button keep working
- [ ] A **`loading.tsx`** (or `<Suspense>` boundary) for the group tab panel, with a skeleton
      shaped like the content — not a spinner in an empty page
- [ ] **The per-request duplication is gone.** `GET /api/groups/:id` and `GET /api/auth/me` are
      fetched at most once per render pass — hoist the shared ones into the group layout, and/or
      memoize per request (`React.cache`). A single tab render must not make the same call twice
- [ ] `GroupHeading` stops issuing a second client-side fetch for data the server already has
- [ ] **`cache: "no-store"` stays.** This is per-user data; the fix is fewer round trips and
      better perceived latency, never caching one member's balances where another could see them
- [ ] The FE/BE boundary holds: `src/app/` still calls Route Handlers and **never** imports
      `src/server/` or Drizzle ([ADR-0001](../../docs/adr/0001-nextjs-fullstack-monolith.md)). If
      the round trips are the real cost, say so with numbers and file the follow-up — don't
      quietly reach past the boundary to win a benchmark
- [ ] **Measured, before and after** — server-render time per tab and the count of API calls per
      tab switch, recorded in the PR. "Feels faster" is not the acceptance criterion
- [ ] Balances are still always read from `GET /api/groups/:id/balances`, never recomputed on the
      client from the feed

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
