---
id: T117
title: Keep an open group in sync while other members are adding expenses
epic: E12-first-use
status: done
depends_on: [T063, T066, T081, T106, T115]
size: M
---

## Context

Two people at the same table add expenses on their own phones, and neither sees the other's until
a hard reload. That's the defect: **nothing in an open group ever refreshes.** Two separate
causes, and both have to be fixed or the tabs disagree with each other.

1. The Gastos feed isn't a query at all. `useExpenseFeed` (extracted by T115) holds the
   server-rendered first page in `React.useState`; *Cargar más* appends, and a create/edit/delete
   patches the array in place or, under an active filter, re-reads the first page imperatively
   through `refetchFiltered`. There is no cache entry to invalidate and nothing that could
   refetch on its own.
2. Every other group read — balances, settlements, insights, display-currency — is a TanStack
   query with `staleTime: Infinity`, seeded from a server-rendered `initialData`. That has two
   consequences, and the second is a defect rather than a missing feature:

   - It disables TanStack's *default* `refetchOnWindowFocus`. Backgrounding the app and coming
     back is how a member most often returns to a group someone else just changed, and today it
     shows exactly what it showed before.
   - **It makes the server's fresh numbers get discarded.** The `QueryClient` lives in the root
     `Providers`, so its cache outlives tab navigation. Returning to Balances re-runs the server
     component and re-computes balances — but `initialData` is ignored when the cache already
     holds data for that key, and `staleTime: Infinity` means nothing refetches to correct it.
     The tab renders the numbers from the *previous* visit. This was verified against
     `@tanstack/react-query` 5.102: remount with a changed `initialData` keeps the old value, and
     only starts honouring the new one once the entry has been garbage-collected (`gcTime`,
     default 5 minutes with no observer). So it self-corrects after five idle minutes, which is
     precisely why it reads as intermittent and has survived this long.

   Note what bounds it: a member's *own* create/edit/delete invalidates `["group", groupId]`, so a
   single-user session is always self-consistent. Only other members' writes go unseen — which is
   why this only shows up once two people are adding expenses at once.

The fix is polling on the mounted tab plus a finite `staleTime`. The finite `staleTime` is the
larger half of the win: it repairs cause 2 outright and restores focus-refetch for a phone that
was in a pocket, at zero scheduled cost.

**Load budget — this was checked before the task was written; don't re-litigate it.** One Gastos
poll is one request → `requireMembership`, one indexed page query (`(expense_date, id)` desc, 50
rows), then payers, splits, the group conversion context, and editor names: roughly half a dozen
small indexed queries against a table holding hundreds of rows, not millions. Balances is
comparable — three group-scoped scans plus the arithmetic in memory. At a 120 s interval, ten
members with the app in the foreground is **0.08 requests/second**; a hundred would be 0.83. The
server is not the constraint at any group size this app will ever see, and neither is Postgres.

What *is* worth respecting: phone radio and battery (so a hidden tab must stop polling), the
refetch fan-out of an infinite query (below), and the pinned-rate promise (below).

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Data loading* and *Balances and the
simplify toggle*, [design-system.md](../../docs/frontend/design-system.md) § *Data — TanStack
Query* and § *Hooks*, [currency.md](../../docs/context/currency.md) for why the FX reads are
excluded, and [testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [x] One shared source for the live-read options — a single module under `src/lib/hooks/` (one
      hook per file, each with a test, per design-system.md § *Hooks*) that names the interval
      **once**. `120_000` unless the implementer has a measured reason to differ, in which case
      say so in the PR
- [x] `useExpenseFeed` reads through TanStack Query instead of `useState`: `useInfiniteQuery`
      keyed by group *and* the serialized filters — `["group", groupId, "expenses", filterQuery]`
      — seeded from the server-rendered first page via `initialData`. **No extra request on
      mount**; the page already paid for that page, and T106 exists because that latency was
      visible
- [x] *Cargar más* becomes `fetchNextPage`, and pages already loaded survive a background
      refetch: a member who has loaded three pages must not be snapped back to one. Appending
      still cannot duplicate a row — the `(expense_date, id)` descending cursor never revisits an
      id, filtered or not (`services/expenses.ts` § `listExpenses`, § `filterConditions`)
- [x] **Bound the fan-out.** A background refetch of an infinite query refetches *every* retained
      page, so ten presses of *Cargar más* would otherwise mean ten requests per poll. This is the
      one way polling here can multiply, and the only part of the load budget that isn't
      trivially safe.

      **Not with `maxPages`, as this task originally said** — that evicts the *first* pages, which
      in a `(date, id)` descending feed are the newest expenses, so the top of the list would
      silently disappear as someone paged into the past. It is only usable with bidirectional
      pagination, and *Cargar más* is forward-only. The timer is capped instead
      (`livePollInterval`): past four loaded pages the feed stops polling, because someone 200
      expenses deep is reading history, and they still refresh on focus and after any write
- [x] `refetchFiltered` disappears. Its job — "a write under an active filter can move a row into
      or out of the result, so only the server knows the answer" — becomes an invalidation of the
      feed's own key, and the filtered/unfiltered branching in `onCreated` / `onUpdated` /
      `onDeleted` collapses with it. Creating or editing an expense stays **non-optimistic**: the
      server resolves the split (design-system.md § *Data*)
- [x] Decide deliberately between the two remount mechanisms and keep only one. The page
      currently forces a fresh feed with `key={filterQuery}` on `<ExpenseFeed>`; once the filters
      are part of the query key, that remount is redundant. Whichever survives, a filter change
      must still drop the loaded pages and the cursor together
- [x] A test covers the discarded-`initialData` case directly: mount a group read, unmount it,
      remount it inside `gcTime` with a *changed* `initialData`, and assert the newer value wins.
      That is the defect in cause 2 above, and the one that produces a confidently wrong balance
- [x] `staleTime: Infinity` is gone from the four group reads — balances (`BalancesTab`,
      `CurrencySwitcher`), settlements (`useSettlements`), insights (`InsightsTab`),
      display-currency (`CurrencySwitcher`) — replaced by the shared finite value, which restores
      `refetchOnWindowFocus` on all of them
- [x] The mounted tab polls the reads it renders, and only those: Gastos → expenses; Balances →
      balances **and** settlements (a plan that moved without its settlements is the wrong-number
      case design-system.md warns about); Análisis → insights. The tabs are separate routes, so a
      device polls one or two endpoints, never all five
- [x] `refetchIntervalInBackground` stays at its default `false`. A hidden or backgrounded tab
      stops polling and catches up on focus
- [x] **The FX reads are excluded and stay excluded.** `fx-quote` (`TransferHint`,
      `ConvertRatePreview`) keeps its 5-minute `staleTime` and gains no interval, and nothing in
      this task may refresh a group's pinned rate — *a pinned rate is never silently refreshed*
      (CLAUDE.md non-negotiable 5). A poll that moved a pinned total would break a product
      promise, not just a cache
- [x] A poll never disturbs work in progress: with the expense form open and an amount half-typed,
      the split editor mid-edit, the settle-up dialog open, or the expense detail expanded, a
      refetch must not close, reset, or reorder under the user. Verify each explicitly
- [x] Tests, same commit: with fake timers, a second member's expense appears in the feed after
      one interval without a remount; retained pages survive a refetch; a filtered feed refetches
      with its filters intact; the FX query's options are unchanged; and an open expense form
      keeps its values across a refetch
- [x] `docs/frontend/design-system.md` § *Data — TanStack Query* states the staleness policy —
      what polls, at what interval, why `staleTime: Infinity` is not the default here, and which
      reads must never poll. Whoever writes the next hook will copy what's written there

## Out of scope

- **Real-time (SSE, WebSocket, or a subscription).** Deliberate: a poll on a handful of phones is
  cheaper to own than a connection that has to survive a Cloudflare Tunnel, a container restart,
  and a phone changing networks. Don't upgrade this to push without a reason polling failed
- Any endpoint or contract change. No `updated_since`, no delta, no ETag/`If-None-Match`
  negotiation — polling reuses the reads exactly as they are, filters included. If payload size
  ever becomes the problem, that's a separate task with a measurement attached
- The filter surface itself (T115, landed). This task changes how the feed *fetches*, not what it
  can filter by, and must not alter the URL-as-source-of-truth behaviour
- Notifications of any kind (T094), and any "3 gastos nuevos" banner or unread affordance. This
  task makes the data current; it does not add a notification surface
- Optimistic expense creation, and any client-side balance derivation

## Files likely touched

```
src/lib/hooks/useLiveGroupQuery.ts                        (new, + test)
src/app/(app)/g/[groupId]/_components/useExpenseFeed.ts   (+ its existing test)
src/app/(app)/g/[groupId]/_components/ExpenseFeed.tsx
src/app/(app)/g/[groupId]/page.tsx                        (only if the key= remount goes)
src/app/(app)/g/[groupId]/_components/BalancesTab.tsx
src/app/(app)/g/[groupId]/_components/useSettlements.ts
src/app/(app)/g/[groupId]/_components/InsightsTab.tsx
src/app/(app)/g/[groupId]/_components/CurrencySwitcher.tsx
docs/frontend/design-system.md
```
