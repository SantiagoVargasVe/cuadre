---
id: T022
title: Group CRUD
epic: E3-groups
status: todo
depends_on: [T021]
size: M
---

## Context

Create, read, rename, archive. The first consumer of the membership guards, so it is also where
the pattern gets set for every group-scoped service that follows.

Read [api-contract.md](../../docs/context/api-contract.md) § *Groups*.

## Acceptance criteria

- [ ] `POST /api/groups { title, description?, defaultCurrency? }` → `201`. The creator becomes
      `owner` and a `group_members` row in the same transaction
- [ ] `defaultCurrency` falls back to `DEFAULT_CURRENCY` and must be in `SUPPORTED_CURRENCIES`
- [ ] `GET /api/groups/:id` → group, members, settings. Members are display names and ids —
      **never email addresses**
- [ ] `PATCH /api/groups/:id { title?, description?, simplifyDebts? }`
- [ ] **`simplifyDebts` is a plain boolean flip.** It writes nothing else, computes nothing, and
      triggers no recalculation — see
      [ADR-0006](../../docs/adr/0006-simplification-is-derived.md). If this handler grows a branch
      that touches balances, something has gone wrong
- [ ] `POST /api/groups/:id/archive` — **owner only**. Archived groups are read-only
- [ ] Title ≤ 200 chars, description ≤ 2000, enforced by Zod at the boundary
- [ ] Every handler calls the guard **inside the service**, not in the route
- [ ] Tests: non-member gets `404` on all four; member-not-owner gets `403` on archive; creating a
      group makes exactly one owner membership; an unsupported currency is `422`

## Out of scope

Member management (T024), invites (T023), the groups list aggregate (T025), display currency
(T053).

## Files likely touched

```
src/app/api/groups/[id]/route.ts
src/app/api/groups/route.ts
src/server/services/groups.ts
src/lib/schemas/groups.ts
```
