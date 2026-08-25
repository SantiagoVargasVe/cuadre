# ADR-0002 — Invite-only registration, unified with group invites

**Status:** Accepted · 2026-08-25

## Context

The site sits on a publicly reachable URL. Open registration on a public URL attracts bot signups,
which means email verification, captcha, and cleanup — none of which serves a tool used by a
handful of friends planning a trip.

Separately, groups need a way to add members. The obvious design is two mechanisms: a registration
invite to get into the app, and a group invite to get into a group.

## Decision

Registration requires a single-use invite code. **One `invite_codes` table serves both purposes**,
distinguished by a nullable `group_id`:

- `group_id = null` → a plain registration invite
- `group_id` set → a group invite that *also* registers you

Codes are consumed in the same transaction that creates the user and, when present, inserts the
group membership. All of it commits together or none of it does.

## Why the unification

The real onboarding flow is "Ana is organising a trip and sends five people a WhatsApp link."
Under two mechanisms, an unregistered recipient hits a group invite, is told to register, needs a
*different* code to do so, and is stuck until Ana sends a second link. That is the common case,
not an edge case.

With one table, the link works for everyone: registered users join, unregistered users register
and land in the group in one step, and `/join/[code]` is the same page either way.

## Why not the alternatives

- **Open registration** — needs email verification plus aggressive rate limiting to stay clean.
  Real work for a benefit nobody asked for.
- **Manual account creation** — makes the operator a bottleneck every time someone joins a trip,
  with no self-service path.
- **Two separate invite tables** — the friction above, plus two consumption paths to keep atomic
  instead of one.

## Consequences

- The first account is bootstrapped by `npm run seed:invite`.
- Any logged-in member can mint a group invite for their own groups. No approval step; the group
  is already a set of people who chose to travel together.
- `GET /api/invites/:code` must be **unauthenticated**, so the register page can show "Ana te
  invitó a *Cartagena 2026*". It returns the group title, the inviter's display name, and nothing
  else — no member list, no ids, no email addresses.
- Consumption uses a conditional `UPDATE … WHERE consumed_at IS NULL RETURNING`. Check-then-insert
  races two people onto one single-use code.
- Expired and consumed codes are indistinguishable in the response. Both are "invalid".
- If the app ever opens up, dropping the gate is a small change plus adding email verification.
