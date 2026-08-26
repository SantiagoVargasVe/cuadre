---
id: T021
title: Membership guards — requireMembership and requireOwner
epic: E3-groups
status: done
depends_on: [T020, T013]
size: S
---

## Context

This app's entire authorization model in two functions. Everything group-scoped calls one of
them, on reads as well as writes, and the reason they land before any group endpoint exists is
that retrofitting them onto endpoints written without them is how one endpoint gets missed.

Read [security.md](../../docs/context/security.md) § *Membership is the authorization model* — it
is mandatory for this task.

## Acceptance criteria

- [x] `requireMembership(groupId, userId)` → returns the membership row, or throws `NotFoundError`
- [x] `requireOwner(groupId, userId)` → throws `ForbiddenError` if a member but not `owner`
- [x] **`removed_at IS NOT NULL` is not a member.** A removed member loses access immediately
- [x] **Non-membership is `404`, not `403`.** Groups are private and their ids are unguessable;
      there is no reason to confirm one exists to an outsider. `403` is reserved for the inside
      case. This deliberately differs from the sibling wishlist repo — note it where it's defined
      so nobody "fixes" it
- [x] An archived group is readable but rejects writes, with a distinct error code
- [x] Both guards live in `src/server/auth/` and are called **inside services**, never in route
      handlers. Document that at the definition
- [x] A helper for the id-addressed case: given an expense or settlement id, load the row, read
      *its* `group_id`, then check. This is where the check gets forgotten, so make the easy path
      the correct one
- [x] Tests: non-member `404`; removed member `404`; member-not-owner `403` on an owner action;
      owner passes; archived group rejects a write

## Out of scope

Applying them to endpoints — that happens in each endpoint's own task.

## Files likely touched

```
src/server/auth/membership.ts
src/server/auth/membership.test.ts
```
