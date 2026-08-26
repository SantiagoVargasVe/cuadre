---
id: T024
title: Member management and removal with a balance guard
epic: E3-groups
status: done
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

- [x] `GET /api/groups/:id/members` → display names, ids, roles, join dates. **Never emails**
- [x] `DELETE /api/groups/:id/members/:userId` — **owner only** — sets `removed_at`
- [x] **Refused with `422` when the member's net balance is non-zero in any currency**, and the
      response `details` carries those balances so the UI can say what's outstanding. You cannot
      walk out mid-trip
- [x] Checked across **every** currency, not just the group's display currency. A member square in
      COP and owed USD must not be removable
- [x] The row is never hard-deleted — historical expenses reference it
- [x] A removed member loses access immediately (already true via T021; add a test that says so)
- [x] An owner cannot remove themselves while they are the only owner
- [x] Re-inviting a removed member reactivates the existing row rather than inserting a duplicate —
      the composite pk would reject the insert anyway, so handle it deliberately
- [x] Tests: removal with a non-zero balance in a second currency is refused; removed member gets
      `404` on group reads; re-invite reactivates

## Out of scope

The members UI (T068). Deleting a user account entirely — not supported in v1.

## Files likely touched

```
src/app/api/groups/[id]/members/route.ts
src/app/api/groups/[id]/members/[userId]/route.ts
src/server/services/members.ts
```

## Implementation notes

**Self-removal beyond the last-owner case.** "Owner only" scopes the whole endpoint — a non-owner
can't remove anyone via it, including themselves; there's no separate self-service "leave group"
flow in this task. Among owners, removing *another* member (owner or not) is only gated by the
balance guard. Removing *yourself* is additionally blocked exactly when you're the sole current
owner — removing a co-owner (including a mutual self/other pairing where a second owner remains)
is fine.

**Reactivation** uses `INSERT ... ON CONFLICT (group_id, user_id) DO UPDATE ... WHERE removed_at
IS NOT NULL` (drizzle's `setWhere`) rather than a separate check-then-branch: a conflict against
a still-active row leaves the `WHERE` unmatched, Postgres does nothing, and `RETURNING` yields no
row — which `acceptInvite` already reads as "already a member" via the exact same
`AlreadyAMemberError` path it used before. Verified this exact behavior against the real test
database (not just inferred from the drizzle types) before trusting it. Reactivation resets role
to plain `member` even if the person was `owner` before being removed — coming back through a
generic invite link shouldn't silently hand back ownership.
