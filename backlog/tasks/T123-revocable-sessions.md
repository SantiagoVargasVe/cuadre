---
id: T123
title: Enforce sessions_valid_from — make sessions revocable
epic: E15-account-recovery
status: todo
depends_on: [T119]
size: M
---

## Context

[ADR-0003](../../docs/adr/0003-jwt-cookie-and-bearer.md) accepted that "a stolen token is valid
until it expires" and listed database sessions as worth revisiting if per-session logout ever
mattered. [ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md) is that moment:
someone resetting because they suspect another person has their password is not helped by a flow
that leaves that person's 30-day cookie working — and here the other person has write access to a
shared ledger.

This task changes the hottest path in the app — every authenticated request — so it is deliberately
separate from T122 and T125 and should be reviewed on its own. Read ADR-0012 § *Why sessions must
become revocable*, which covers both where the check runs and the `iat` granularity rule; getting
either backwards is the whole risk here.

Read [security.md](../../docs/context/security.md) § *Authentication*, ADR-0003, and
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Routes* (why covering the route boundary is
enough to cover Server Components).

## Acceptance criteria

- [ ] `verifySessionToken` returns the token's `iat` alongside `userId`; today it discards it
- [ ] `getSession(request)` verifies the JWT **and then** compares `iat` against
      `users.sessions_valid_from`, returning null when the token predates it. Cookie and Bearer are
      covered by the same code because both already resolve through this one function (ADR-0003)
- [ ] `getSessionFromCookies()` — the `/` redirect — applies the same check. A revoked session must
      not be bounced to `/groups`
- [ ] **`src/middleware.ts` stays crypto-only.** It runs on the Edge runtime, where the Postgres
      driver cannot follow, and it is a redirect gate rather than an authorization boundary. Do not
      switch it to the Node runtime to add a lookup: that buys a redirect at the price of a second
      identical read on every navigation. Leave a comment saying so, because "the middleware
      doesn't check" reads like an oversight
- [ ] Because middleware lets a revoked token through, `apiFetchServer` turns a `401` into
      `redirect("/login")` so a server-rendered page lands on the login screen instead of an error
      boundary. Every authenticated page fetches through it, so this is one change, not one per page
- [ ] The shell's existing `["me"]` query sends the user to `/login` on a `401`, so an open tab
      whose session was revoked elsewhere doesn't sit there failing every refetch
- [ ] The comparison is a plain `iat >= sessions_valid_from` against a column already truncated to
      the second by T119. **Add a test that pins the boundary explicitly**: a token issued in the
      revoking second is invalid, and one issued in the following second is valid
- [ ] Exactly one DB read per session resolution, and `requireUserId` does not duplicate it
- [ ] A token for a user row that no longer exists resolves to null rather than throwing — "not
      logged in", not a 500
- [ ] Tests: valid session; token predating a bump; token after a bump; the same-second boundary in
      both directions; missing user; malformed token still returns null and never throws; both the
      cookie and the Bearer path (ADR-0003 requires both to be covered, always)
- [ ] `security.md` § *Authentication* says sessions are revocable and how; ADR-0003's "there is no
      per-session revocation" consequence is marked superseded by ADR-0012

## Out of scope

A session table, refresh tokens, a "cerrar sesión en todos lados" control, and any change to token
TTL or cookie attributes. Writing `sessions_valid_from` — T122 does that. **Do not cache the
lookup**: a cache here reintroduces exactly the staleness this removes.

## Files likely touched

```
src/server/auth/session.ts
src/server/auth/session.test.ts
src/server/auth/jwt.ts
src/lib/api/server.ts
src/app/_shell/UserMenu.tsx
src/middleware.ts
docs/context/security.md
docs/adr/0003-jwt-cookie-and-bearer.md
```
