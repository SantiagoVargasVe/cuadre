---
id: T063
title: /g/[groupId] — group detail and expense feed
epic: E7-frontend
status: done
depends_on: [T060, T061, T036]
size: M
---

## Context

The Gastos tab: the screen members spend the most time on. Read-heavy, server-rendered, and the
launchpad for the add-expense flow.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Server vs client components* and
§ *Data loading*.

## Acceptance criteria

- [x] Server-rendered feed, paginated, ordered newest first
- [x] Each row: title, date, total, who paid, and **your** share — the number a member is actually
      looking for
- [x] An edited expense shows an "editado" marker with who and when (the data exists from T035)
- [x] **The add-expense affordance is a fixed bottom-right FAB on mobile.** It is the most-used
      control in the app and it does not scroll away
- [x] Tapping a row opens the expense detail with the full split breakdown
- [x] When the group has a display currency, amounts are marked as converted with the original
      reachable
- [x] Empty state prompts the first expense
- [x] Infinite scroll or an explicit "load more" — either, but the cursor must not duplicate rows
      on a day with several expenses
- [x] Verified at 375px, one-handed
- [x] Tests: the feed renders paginated results; the edited marker appears; your-share is computed
      from the server's resolved splits, never recomputed client-side

## Out of scope

The expense form (T064, T065). Balances (T066).

## Files likely touched

```
src/app/g/[groupId]/page.tsx
src/app/g/[groupId]/_components/{expense-row,expense-detail}.tsx
```
