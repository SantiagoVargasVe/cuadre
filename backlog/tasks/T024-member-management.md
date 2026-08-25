---
id: T024
title: Member management and removal with a balance guard
epic: E3-groups
status: todo
depends_on: [T022, T040]
size: S
---

## Context

**This is the one E3 task that cannot land until E5.** Removing a member has to refuse while they
still owe or are owed anything, and that requires the balance engine. Everything else in E3 ships
without it; pick this up after T040.

Read [data-model.md](../../docs/context/data-model.md) § *Deletion semantics* and
[api-contract.md](../../docs/context/api-contract.md) § *Members and invites*.

## Acceptance criteria

- [ ] `GET /api/groups/:id/members` → display names, ids, roles, join dates. **Never emails**
- [ ] `DELETE /api/groups/:id/members/:userId` — **owner only** — sets `removed_at`
- [ ] **Refused with `422` when the member's net balance is non-zero in any currency**, and the
      response `details` carries those balances so the UI can say what's outstanding. You cannot
      walk out mid-trip
- [ ] Checked across **every** currency, not just the group's display currency. A member square in
      COP and owed USD must not be removable
- [ ] The row is never hard-deleted — historical expenses reference it
- [ ] A removed member loses access immediately (already true via T021; add a test that says so)
- [ ] An owner cannot remove themselves while they are the only owner
- [ ] Re-inviting a removed member reactivates the existing row rather than inserting a duplicate —
      the composite pk would reject the insert anyway, so handle it deliberately
- [ ] Tests: removal with a non-zero balance in a second currency is refused; removed member gets
      `404` on group reads; re-invite reactivates

## Out of scope

The members UI (T068). Deleting a user account entirely — not supported in v1.

## Files likely touched

```
src/app/api/groups/[id]/members/route.ts
src/app/api/groups/[id]/members/[userId]/route.ts
src/server/services/members.ts
```
