---
id: T109
title: Grow the personal-settings surface (/cuenta)
epic: E12-first-use
status: done
depends_on: [T108]
size: M
---

## Context

[T108](T108-avatar-editor.md) created `/cuenta` (`src/app/(app)/cuenta/`) as the first
personal-settings surface — an avatar is a property of the *user*, not of a group, so it can't
live in a group's Ajustes. Right now that page holds **only** the avatar editor.

The things a user should be able to change about *themselves* — not about a group — still have no
home: **display name**, **password** (once there's a real reset story — see
[roadmap.md](../../docs/roadmap.md) § E11), and email. This task fleshes `/cuenta` into a proper
personal-settings page and adds display-name editing, which is the one that bites first (a typo at
registration currently follows you into every group's member list and every historical row).

Read [api-contract.md](../../docs/context/api-contract.md) § *Auth*,
[security.md](../../docs/context/security.md) § *Privacy*, and
[design-system.md](../../docs/frontend/design-system.md).

## Acceptance criteria

- [ ] `/cuenta` reads as a settings page with sections, not a single card — the avatar editor
      becomes one section among "Perfil" and (later) "Seguridad"
- [ ] **Display name** is editable: a form, `PATCH /api/auth/profile` (or similar), session user
      only — never a user id from the body. Zod-validated at the boundary, same bounds as
      registration's `displayName`
- [ ] Changing the display name updates it everywhere it's read from — it is not seeded into
      anything immutable (unlike the avatar seed, which is deliberately `userId`-based). Confirm
      the member lists, payer/split rows and settlement history all reflect the new name after a
      refresh
- [ ] The page is reachable — it already is from the header avatar/name link (T108); add it to
      any future nav/menu too
- [ ] Every string through i18n keys; works at 375px
- [ ] Tests: the name updates for the session user only; a body `userId` is ignored; no endpoint
      in the flow returns another member's email

## Out of scope

- **Password change / reset** — needs the SMTP-or-nothing decision from roadmap.md § E11. Add a
  disabled "Seguridad" placeholder at most; don't build the flow here.
- **Email change** — same story (verification needs mail).
- Anything group-scoped. Per-group nicknames are explicitly not a thing.
- Account deletion — roadmap.md § E11, unresolved.

## Files likely touched

```
src/app/(app)/cuenta/page.tsx
src/app/(app)/cuenta/_components/            (a ProfileForm)
src/app/api/auth/profile/                    (new — or extend an existing auth route)
src/server/services/auth.ts
src/lib/schemas/auth.ts
src/lib/i18n/es.ts
docs/context/api-contract.md
```
