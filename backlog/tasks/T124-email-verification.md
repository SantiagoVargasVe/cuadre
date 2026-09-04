---
id: T124
title: Email verification — send at registration, verify and resend endpoints
epic: E15-account-recovery
status: done
depends_on: [T120, T121, T122]
size: M
---

## Context

The working half of [ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md):
registration sends a verification message, and a token exchange marks the address verified.

The rule that shapes this task and is easy to concede under review pressure: **verification gates
nothing but recovery.** Not login, not the invite/join flow, not any endpoint, not the app shell.
The ADR argues it at length — blocking login would lock out every existing account on deploy, would
put an inbox round-trip in the middle of the flow this product protects most, and would make
outbound mail a hard dependency in contradiction of
[ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md). If this task starts adding checks to
other routes, it has gone wrong.

Reuse T122's primitives. If verification appears to need its own mint/consume, either T122 was
scoped too narrowly or T119's shared-table decision was wrong — say which in the PR rather than
quietly writing a second implementation of the consume statement.

This is the first task that actually sends mail, which is why it depends on T121: the published
Terms currently promise that Cuadre does not verify email addresses.

Read ADR-0013, ADR-0011, [api-contract.md](../../docs/context/api-contract.md) § *Auth*, and
[security.md](../../docs/context/security.md) § *Privacy*.

## Acceptance criteria

- [ ] Registration sends the verification message **after** the account transaction commits. A mail
      failure must never roll back a registration that also consumed an invite code and created a
      group membership (ADR-0002)
- [ ] Registration succeeds normally when mail is unconfigured or the send fails: the person is
      registered, logged in, and unverified, and the failure is logged rather than surfaced as a
      registration error. This holds for both entry points — `/register` and the `/join/[code]`
      flow
- [ ] `POST /api/auth/verify-email` — unauthenticated, Zod-validated `{ token }`, sets
      `email_verified_at`, returns `204`. Invalid, expired, used and wrong-purpose tokens all
      return the same generic `400`. Rate limited per IP with T122's `emailVerifyConsume`
- [ ] `POST /api/auth/resend-verification` — authenticated, Origin-checked, rate limited per **user**
      with `verificationResend`, mints a fresh token and invalidates the previous one. Returns
      `204` whether or not the account is already verified, so it reveals nothing a caller doesn't
      already know about their own account
- [ ] `GET /api/auth/me` returns the caller's verification state. It is the only endpoint that may:
      `me` is already the only endpoint that returns an email, and whether a co-member has confirmed
      their inbox is not the group's business (ADR-0013). **No group read gains a verified flag**
- [ ] Mail copy is Spanish, plain-text **and** HTML, states the 24-hour expiry and single use, and
      contains nothing but the link — no password, no group name, no third-party link, no tracking
      pixel or remote image
- [ ] Mail copy lives outside `src/lib/i18n/es.ts`. That module is imported by client components
      and ships in the browser bundle; message bodies belong in a server-only catalogue next to the
      templates, the way `legal-es.ts` is kept separate from the rest
- [ ] The link is built from `config.APP_URL` and points at `/verify-email/[token]`
- [ ] Nothing else in the app reads `email_verified_at`. Grep for it before opening the PR — the
      only consumers are this task's endpoints, T125's gate, and T127's prompt
- [ ] Real-Postgres tests: happy path; second use fails; expired fails; **cross-purpose rejected in
      both directions**; resend invalidates the previous token; registration still commits
      atomically when the mailer throws; registration works with mail unconfigured; `me` exposes
      verification state and no other endpoint does
- [ ] `api-contract.md` documents the two endpoints, the `me` field, and their rate limits;
      `security.md` § *Known accepted risks* loses the "No email verification" bullet

## Out of scope

The `/forgot-password` gate — T125 owns it, which is what makes reset unshippable without this. All
UI, including the prompt and the `/verify-email/[token]` page (T127). Blocking login, the join
flow, or anything else on verification. Changing an account's email address (deliberately not in
this epic — see the E15 note in [backlog/README.md](../README.md)).

## Files likely touched

```
src/server/services/email-verification.ts
src/server/services/email-verification.test.ts
src/server/services/auth.ts
src/server/mail/templates/verify-email.ts
src/server/mail/copy-es.ts
src/app/api/auth/verify-email/route.ts
src/app/api/auth/resend-verification/route.ts
src/app/api/auth/me/route.ts
docs/context/api-contract.md
docs/context/security.md
```
