---
id: T025
title: GET /api/groups and the group detail aggregate
epic: E3-groups
status: todo
depends_on: [T022, T040]
size: M
---

## Context

The two read endpoints the app opens on. `/groups` shows your net position in each group, which
means it needs the balance engine — so like T024, this is written in E3 but picked up after T040.

Read [api-contract.md](../../docs/context/api-contract.md) § *Groups* and
[architecture.md](../../docs/context/architecture.md) § *Data flow: reading balances*.

## Acceptance criteria

- [ ] `GET /api/groups` → your non-archived groups with `{ id, title, memberCount, yourNet[] }`
- [ ] **`yourNet` is an array.** A member can be up in one currency and down in another; a scalar
      here would force a wrong summation somewhere downstream
- [ ] Archived groups are returned separately or flagged, never silently dropped
- [ ] **One query, not N+1 across groups.** A user with eight groups must not produce eight
      balance computations issued serially
- [ ] `GET /api/groups/:id` returns group, members, and settings — including `displayCurrency` and
      `simplifyDebts` so the UI renders the right mode on first paint
- [ ] No email addresses in either response
- [ ] `Σ net == 0` is asserted per currency inside the balance computation before responding
      (inherited from T040 — verify it fires here)
- [ ] Tests: a user in three groups gets three entries; a member with mixed-currency positions
      gets one entry per currency; a non-member's group never appears

## Out of scope

The expense feed (T036). The balances detail endpoint (T044). The UI (T062, T063).

## Files likely touched

```
src/app/api/groups/route.ts
src/app/api/groups/[id]/route.ts
src/server/services/groups.ts
```
