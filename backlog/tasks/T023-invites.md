---
id: T023
title: Invite minting, public lookup, and acceptance
epic: E3-groups
status: todo
depends_on: [T022, T011]
size: M
---

## Context

The onboarding flow, and the first thing a real user touches. One link has to work for a person
who already has an account and a person who doesn't — that unification is the whole point of the
single `invite_codes` table.

Read [ADR-0002](../../docs/adr/0002-invite-only-registration.md) and
[security.md](../../docs/context/security.md) § *Invite codes*.

## Acceptance criteria

- [ ] `POST /api/groups/:id/invites { expiresAt? }` → `201 { code, url }`. Any member of the group
      may mint one; no approval step
- [ ] `url` is built from `APP_URL` — nothing hardcodes a domain
- [ ] `GET /api/invites/:code` is **unauthenticated**. The register page must render "Ana te invitó
      a *Cartagena 2026*" before anyone has an account
- [ ] That endpoint returns **only** `{ groupTitle?, inviterName, valid }`. No member list, no
      expense count, no ids, no email addresses. Someone with a leaked code learns a trip's name;
      that is the accepted floor
- [ ] Rate limited by IP — it's unauthenticated and looks enumerable even at 16 chars of nanoid
- [ ] `POST /api/invites/:code/accept` for an already-registered user → adds membership, `409` if
      already a member
- [ ] Acceptance uses the same conditional-update consumption as T011 — zero rows means `409`
- [ ] Expired and consumed codes are indistinguishable: both `{ valid: false }`
- [ ] `/join/[code]` page: logged out → the invite context plus a register form prefilled with the
      code; logged in → a join button. Both land on the group
- [ ] Tests: public lookup leaks nothing beyond the three fields; expired reads as invalid;
      double-accept is `409`; the logged-out path registers and joins in one step

## Out of scope

Removing members (T024). Group settings UI (T068).

## Files likely touched

```
src/app/api/groups/[id]/invites/route.ts
src/app/api/invites/[code]/route.ts
src/app/api/invites/[code]/accept/route.ts
src/app/join/[code]/page.tsx
src/server/services/invites.ts
```
