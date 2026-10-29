---
id: T134
title: Make group invite links reusable for 24 hours
epic: E3-groups
status: todo
depends_on: [T023, T024, T068]
size: M
---

## Context

A group organizer should be able to paste one invite link into a friends' chat and let everyone
join. Today `consumeInvite` marks every code consumed by the first successful registration or
acceptance, and the invite panel supplies no expiry. Newly created group links should instead
admit multiple people for 24 hours, including people who still need to register.

Example: Ana sends one URL to Beto, Caro and Dani. Beto already has an account and joins;
Caro and Dani each create their own accounts through that same URL and automatically become
members of Ana's group. None needs a second invite or a separate registration code, and none
of these successful actions prevents the others from using the URL before its deadline.

Read these before implementation:

- [ADR-0002](../../docs/adr/0002-invite-only-registration.md): the current single-use decision;
  write a follow-up ADR before changing it, preserving the unified register-and-join flow.
- [security.md](../../docs/context/security.md),
  [data-model.md](../../docs/context/data-model.md) and
  [api-contract.md](../../docs/context/api-contract.md) § Auth / Members and invites.
- [backend conventions](../../docs/backend/CLAUDE.md),
  [frontend conventions](../../docs/frontend/CLAUDE.md),
  [design-system.md](../../docs/frontend/design-system.md) and
  [testing.md](../../docs/context/testing.md).

Use an explicit distinction between new reusable group invites and legacy single-use codes
(for example, an additive reuse flag defaulting to false). Merely ignoring `consumed_at` whenever
`group_id` is set would reactivate previously used links. Keep the existing plain registration
invite and bootstrap behavior.

## Acceptance criteria

- [ ] Any current member can generate a group invite with the existing UI. One newly minted
      URL works for multiple distinct users; successfully joining does not invalidate it.
- [ ] New reusable group links expire exactly 24 hours after creation, calculated on the server
      in UTC. Reuse never extends that deadline. The API cannot create a non-expiring reusable
      link or extend its lifetime through a client-supplied `expiresAt`.
- [ ] The same link authorizes both account creation and membership in its group. Multiple new
      users can each register through it and automatically join; there is no separate registration
      invite, approval or second group link. Existing users can join while logged in, or log in
      from the invite page and return to that same group invite without losing its context.
      Account creation, legal acknowledgements and membership remain transactional: a failed
      registration leaves no orphan account or membership and does not invalidate the link.
- [ ] Concurrent joins by different users all succeed before expiry. Repeated or concurrent
      acceptance by the same user cannot create duplicate memberships or change their role.
      Preserve the existing `ALREADY_A_MEMBER` behavior for active members and the existing
      reactivation behavior for removed members (plain member, never restored owner).
- [ ] Expiry is enforced during public lookup, acceptance and registration, including exactly
      at the deadline (`now >= expiresAt`). Opening a link never creates or changes membership.
      Unknown/expired links remain invalid, and an archived group cannot admit users through one.
- [ ] Plain registration invites remain single-use, including the existing concurrency guarantee
      that only one registration can consume a code.
- [ ] Add a reviewed migration if schema changes are needed. Previously consumed or expired
      links stay invalid; existing unconsumed legacy links retain their single-use semantics.
      Do not backfill legacy links into unlimited or newly valid reusable invites.
- [ ] Return the new link's expiry to the UI and explain in Spanish that the same link can be
      shared with multiple people and expires in 24 hours. A user can generate a fresh link
      after expiry without refreshing the page. Keep strings in i18n and components <= 100 lines.
- [ ] Preserve member-only invite creation, Origin checks, existing rate limits and public
      lookup's limited metadata. Holding a valid invite grants membership only to its group.
- [ ] PostgreSQL integration tests cover sequential and concurrent reuse across existing/new
      users, duplicate joins, removed members, rollback, legacy codes, plain single-use races,
      archived groups and the exact expiry boundary. Use a controlled clock for expiry cases.
      Include one scenario with two separate new-account registrations plus an existing user's
      acceptance all using the same URL. Add route and UI tests for register-and-join, preserving
      invite context across login, expiry metadata, shared-link copy and generating another link.
- [ ] Update ADR references and the product, data model, API and security documentation to
      distinguish reusable group links from single-use registration/legacy codes. Run
      `npm run test:ci` with PostgreSQL before opening the implementation PR.

## Out of scope

Open registration without an invite; reusable plain registration invites; configurable expiry
or use-count limits; email/SMS invitation delivery; invite-management/revocation screens; changes
to existing members, financial history, password-reset or email-verification tokens; deployment.

## Files likely touched

`src/server/services/{invites,auth}.ts` and their tests;
`src/server/db/schema.ts` and an additive migration;
`src/lib/schemas/invites.ts`; invite API routes and tests;
`src/app/(auth)/join/[code]/`; group settings `InvitePanel` and tests;
`src/lib/i18n/es.ts`; `docs/adr/` and related context documents.
