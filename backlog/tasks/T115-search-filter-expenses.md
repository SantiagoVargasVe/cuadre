---
id: T115
title: Search and filter the expense feed
epic: E10-quality-of-life
status: done
depends_on: [T036, T063, T090]
size: L
---

## Context

Gastos is the screen members use most, but once a group has more than a short trip's worth of
expenses the only way to find an old charge is to keep loading pages and scan them by eye. Add a
compact search and filter surface that can answer the common questions—"where is the hotel?",
"what did Ana participate in?", and "show me August in COP"—without weakening the feed's stable
cursor pagination.

Filtering must happen in PostgreSQL before the cursor and page limit are applied. Filtering only
the rows already loaded in the client would silently omit valid matches and make the result depend
on how many times someone pressed *Cargar más*.

Read [product.md](../../docs/context/product.md),
[api-contract.md](../../docs/context/api-contract.md) § *Conventions* and *Expenses*,
[security.md](../../docs/context/security.md) § *Membership is the authorization model* and
*Privacy*, [splitting.md](../../docs/context/splitting.md) for the payer/split distinction,
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Data loading*, *Responsive*, and
*Accessibility*, [design-system.md](../../docs/frontend/design-system.md), and
[testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [ ] Extend `GET /api/groups/:id/expenses` with optional `q`, `category`, `currency`, `member`,
      `from`, and `to` query parameters while preserving `cursor` and `limit`. Document the
      contract in `api-contract.md`
- [ ] Validate the complete query at the route boundary with Zod. `q` is trimmed and capped at 200
      characters; `category` accepts the fixed T090 keys plus an explicit `uncategorised`
      sentinel; `currency` uses the app's supported currency schema; `member` is a UUID; `from`
      and `to` are sane calendar dates; and `from > to` returns `400`
- [ ] `q` performs a case-insensitive literal substring search of the expense title. PostgreSQL
      wildcard characters in user input (`%`, `_`, and the escape character) are escaped, so they
      search for themselves rather than becoming an accidental match-all expression
- [ ] Filters combine with AND semantics. Date bounds are inclusive. The member filter matches an
      expense when that user appears in either its payer rows or its split rows, and returns each
      expense once even when the member appears on both sides. Historical rows for a removed
      participant remain discoverable; the acting user must still pass the existing current-group
      membership check inside `listExpenses`
- [ ] Apply every active filter before the stable `(expense_date DESC, id DESC)` cursor and page
      limit. Every *Cargar más* request carries the same filters, and filtered pagination neither
      duplicates nor skips rows with the same date
- [ ] The Gastos tab has one search field plus a compact *Filtros* disclosure for category,
      person, currency, and inclusive date range. Active filters remain obvious through a count or
      chips and a single *Limpiar filtros* action; controls stack cleanly at 375px and interactive
      targets remain at least 44px
- [ ] The URL query string is the source of truth. The server renders the first filtered page;
      applying or clearing filters replaces that page and cursor; reload, browser back/forward,
      and a copied URL reproduce the same result. Omit empty/default parameters rather than
      serialising them
- [ ] Distinguish an empty group from a filter with no matches. The filtered empty state explains
      that no expenses match and offers *Limpiar filtros* without hiding the add-expense FAB
- [ ] After create, edit, or delete while any search/filter is active, reset and fetch the first
      filtered page from the endpoint so an expense can correctly enter or leave the result. Do
      not guess title, participant, category, date, or currency matches from client state. The
      existing unfiltered local update behaviour may remain
- [ ] CSV export continues to mean the complete live ledger. It sends none of these filters and
      its placement/copy must not imply that only the visible result will be exported
- [ ] Real-Postgres service/route tests cover each filter, combined filters, literal wildcard
      search, inclusive dates, payer-or-split membership without duplicates, deleted expenses,
      stable filtered pagination, malformed query input, and `404` for non-members and removed
      acting members
- [ ] Frontend tests cover server-rendered initial filters, applying and clearing filters, URL and
      back-navigation state, filtered *Cargar más*, the no-match state, and create/edit/delete
      refreshes under an active filter. Verify the layout manually at 375px, 768px, and 1280px
- [ ] All visible strings come from i18n, no new runtime dependency is introduced, and
      `npm run test:ci` passes

## Out of scope

- Fuzzy search, full-text ranking, autocomplete, saved/recent filters, cross-group search, or
  searching notes and revision history
- Filtering CSV export, changing the export contract, or exporting only the current page
- Client-side filtering of loaded rows, client-side money aggregation, or changing cursor order
- Free-form categories, custom date presets, automatic categorisation, or a new database index
  without query-plan evidence that one is needed

## Files likely touched

```
src/app/api/groups/[id]/expenses/route.ts
src/server/services/expenses.ts
src/server/services/expenses.test.ts
src/lib/schemas/expenseFilters.ts
src/app/(app)/g/[groupId]/page.tsx
src/app/(app)/g/[groupId]/_components/ExpenseFeed.tsx
src/app/(app)/g/[groupId]/_components/ExpenseFeed.test.tsx
src/app/(app)/g/[groupId]/_components/ExpenseFilters.tsx
src/lib/i18n/es.ts
docs/context/api-contract.md
```
