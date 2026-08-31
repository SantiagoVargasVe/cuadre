---
id: T108
title: Avatar editor — choose and reroll an avatar within boring-avatars
epic: E12-first-use
status: done
depends_on: [T107]
size: M
---

## Context

[T107](T107-member-avatars.md) gives everyone one deterministic avatar seeded by their `userId`.
It is a good default and it is not negotiable-by-the-user, which some people will want to change.

This is the editor. Scoped to **what `boring-avatars` can already generate** — no uploads, ever.
Accepting an image file means a file-storage mount, image validation, decompression-bomb and SVG
guards, and the permission traps that come with all of it: a materially different task,
deliberately deferred (`T091`).

**The insight that makes this a good flow rather than a dropdown.** `boring-avatars` derives
everything from three inputs — `variant` (six of them), the `name` seed, and a `colors` palette.
So the natural interface is not "pick a style from a `<select>`"; it is **a grid of live
candidates you can reroll until you like one**. Six variants × a reroll button covers a very
large space with two controls and no typing.

**And the reroll is what keeps it safe.** The seed is persisted and rendered into other members'
pages, so a free-text seed field would be stored input from one user rendered on another's
screen. Don't build one. The app generates opaque seeds itself (`nanoid` is already a dependency)
and the member picks from what it generated — so every stored value is app-produced and bounded,
and the validation question mostly disappears.

Read [data-model.md](../../docs/context/data-model.md),
[api-contract.md](../../docs/context/api-contract.md), and
[security.md](../../docs/context/security.md) § *Privacy*.

## Acceptance criteria

### The flow

- [x] `/cuenta` → `AvatarEditor`: the current avatar at 96px (and 24px beside it), then a live
      6-tile grid rendered with the real `<Avatar>` / `boring-avatars`
- [x] All six variants are the six grid tiles (`AVATAR_VARIANTS`)
- [x] "Otra" rerolls the seed (`nanoid(12)`) → every tile updates; asserted the geometry changes
      and no variant is dropped
- [x] Grid tiles render at 32px (row size); the preview shows 96px **and** 24px
- [x] State is local until **Guardar**; leaving `/cuenta` without saving changes nothing —
      asserted (no write before Guardar)
- [x] "Usar el predeterminado" — one click, `PUT` with `null` (clearing the columns is the only
      way back to the `userId`-seeded default, since a UUID can't be a stored seed)

### Storage and validation

- [x] `users.avatar_variant` / `avatar_seed` / `avatar_palette` — all nullable `text`, `null` =
      T107 default. Migration `0008_user_avatar_choice` is 3 `ADD COLUMN`s, no backfill
- [x] No seed input — the editor only ever sends a `nanoid` it generated. The Zod schema rejects
      anything not matching `[A-Za-z0-9_-]{6,24}` (asserted: `"hi mom"`, `"x"` → 400)
- [x] `avatarChoiceSchema` = `z.enum(AVATAR_VARIANTS)` + `z.enum(AVATAR_PALETTE_NAMES)` + the seed
      regex; `avatar_palette` stores the **name** (`default`/`cool`/`warm`), hexes live only in
      `src/lib/avatar` (theme-derived, commented). Unknown variant/palette → 400 (asserted)
- [x] `PUT /api/auth/avatar` reads `requireUserId(request)`; the body has no `userId`. Asserted:
      a `userId` smuggled into the body is ignored, only the session user's row changes
- [x] `avatar` added to `GroupMemberSummary` (`GET /api/groups/:id`) and `MemberSummary` (`GET
      /api/groups/:id/members`) and the `me`/`login`/`register` `user`. Rows that only carry ids
      (plan edges, settlement history) resolve it via a `buildMemberLookup(members)` map. The
      `PUT` responds with just `{ avatar }` — asserted the response has no `@`
- [x] `parseBody(request, avatarChoiceSchema)` at the route, before `updateAvatar`

### Placement

- [x] Lives on a new `/cuenta` route, not any group screen. That surface didn't exist — T108
      creates the minimal version (avatar only) and **T109** is written to grow it (display-name
      editing, etc.)
- [x] Grid is `grid-cols-3 sm:grid-cols-6` — 2 rows of 3 on a phone, one-handed; verified at 375px

### Tests

- [x] `route.test.ts`: unknown variant/palette → 400; `null` clears the columns; `avatar.test.ts`:
      `resolveAvatar` falls back per-field for null/malformed
- [x] `route.test.ts`: a body `userId` is ignored; only the session user's row changes
- [x] `Avatar.test.tsx`: the same stored choice renders byte-identical SVG for a different viewer
- [x] `PUT /api/auth/avatar` returns `{ avatar }` only; the member reads add `avatar`, never
      `email` — asserted the group-detail members response still contains no `@`

## Out of scope

**Uploading an image — permanently out for v1.** Editing display name, email or password; this is
the avatar only. Per-group avatars. Animated or seasonal avatars.

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/server/services/
src/app/api/auth/…                     (or wherever personal settings land)
src/app/_ui/Avatar.tsx                 (reads the stored variant/seed/palette; default from T107)
src/app/…/AvatarEditor.tsx             (new)
src/lib/i18n/es.ts
docs/context/{data-model,api-contract}.md
```
