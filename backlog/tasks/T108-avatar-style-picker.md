---
id: T108
title: Let a member pick their avatar style
epic: E12-first-use
status: todo
depends_on: [T107]
size: S
---

## Context

Follow-up to [T107](T107-member-avatars.md), which ships one deterministic avatar per member with
no way to change it. Some people will want a different one.

Scoped deliberately narrow: **a choice among the variants the avatar library already offers**, not
an upload. Accepting an image file would introduce a file-storage mount, image validation, and
the permission traps that come with both — a materially different task, deliberately deferred
(`T091`).

Separate from T107 because it is the first thing here that needs a schema change, and T107 is
worth shipping without waiting for one.

Read [data-model.md](../../docs/context/data-model.md) and
[api-contract.md](../../docs/context/api-contract.md).

## Acceptance criteria

- [ ] A member can pick their own avatar variant from the library's options and see it applied
      everywhere immediately
- [ ] **Only library-provided options.** No file input, no URL field, no arbitrary image source
      anywhere in the flow
- [ ] Persisted on the user — a nullable column with a migration; **null means the T107 default**,
      so existing users are unaffected and the column can be dropped without data loss
- [ ] The stored value is **validated against the known variant list** at the API boundary. It is
      rendered into other members' pages, so an unvalidated string is a stored-input problem, not
      a preference
- [ ] The seed stays `userId` — picking a style changes the *style*, not the identity the avatar
      is derived from ([T107](T107-member-avatars.md))
- [ ] A member may only change **their own** avatar; the endpoint takes the acting user from the
      session and never a user id from the body
- [ ] Co-members see the chosen variant — so the members/group reads that already return
      `displayName` carry the variant too. **Still no email in any response**
- [ ] Lives with the other personal settings, not in a group's Ajustes — it is a property of the
      user, not of one group
- [ ] Tests: an invalid variant is rejected; null falls back to the default; one user cannot
      change another's

## Out of scope

Uploading an image — permanently out for v1, see above. Display names, passwords, or any other
profile editing; if this turns out to need a profile screen that doesn't exist yet, write that
task rather than growing this one.

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/server/services/
src/app/api/auth/
src/app/_ui/Avatar.tsx
docs/context/{data-model,api-contract}.md
```
