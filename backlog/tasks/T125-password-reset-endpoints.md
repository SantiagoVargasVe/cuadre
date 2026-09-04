---
id: T125
title: POST /api/auth/forgot-password and /api/auth/reset-password
epic: E15-account-recovery
status: todo
depends_on: [T120, T122, T123, T124]
size: M
---

## Context

The HTTP surface of [ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md), plus
the reset message itself. T122 owns the domain logic; this task is the route boundary, the
enumeration-safe response, and the mail body.

One rule shapes everything: **`/forgot-password` returns the same `202` no matter what.**
Registered, unknown, unverified, or a failed send — identical status, identical body, identical
timing. Any branch a client can observe is an account-enumeration oracle. Read ADR-0012 §
*Enumeration, and where it actually leaks* for what this does and does not buy.

**The dependency on T124 is structural, not sequencing.**
[ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md) makes a verified address a
prerequisite for self-service reset: a link mailed to a mistyped address goes to whoever owns the
typo, and this endpoint is public, so they can ask for one whenever they like. The gate lives in
this task so that reset **cannot ship without it**. Do not split it out to unblock a release.

The dependency on T123 is the same kind of thing. A reset that leaves the other person's session
working has done nothing about the actual problem while implying it has.

Read [api-contract.md](../../docs/context/api-contract.md) § *Auth* and § *Rate limits*,
[security.md](../../docs/context/security.md) § *Authentication*, and both ADRs.

## Acceptance criteria

- [ ] `POST /api/auth/forgot-password` — Zod-validated `{ email }`, Origin-checked, always `202`
      with an identical body. An unknown address mints no token and sends no mail
- [ ] **An unverified address mints no token and sends no mail — and gets the same `202`.** This is
      the criterion that closes the takeover path in ADR-0013; the rest of this task is the flow
      around it
- [ ] A mail send failure is caught, logged at error level, and **still returns `202`** — a provider
      outage must not become an enumeration oracle. This is the one place where swallowing an error
      is correct, so say so in a comment rather than leaving the next reader to assume it's a bug
- [ ] When mail is unconfigured, the endpoint still returns `202` and logs that a token was minted
      but not delivered, naming `scripts/reset-link.ts` — that is the supported path in that
      configuration (ADR-0011)
- [ ] The three silent no-send cases — unknown, unverified, send failure — are distinguishable
      **only** in the server log, and each logs distinctly. Per ADR-0013 this is the sole diagnostic
      for the whole flow, so one shared generic log line defeats it. Log the user id where there is
      one, the recipient domain at most, never the address and never the token
- [ ] `/forgot-password` consumes **two** buckets — per IP and per hashed address (T122) — and is
      refused if either is exhausted. `429` carries `Retry-After`, like every other limited route
- [ ] `POST /api/auth/reset-password` — Zod-validated `{ token, password }`, password held to
      exactly registration's rules by reusing the schema in `src/lib/schemas/auth.ts` rather than
      restating them, `204` on success, rate limited per IP
- [ ] Invalid, expired, used and wrong-purpose tokens all return the same `400` with one generic
      code
- [ ] Success **does not log the user in** and sets no cookie — it is a `204`, and the page
      redirects to `/login` (T126). A link arriving in a mailbox is not proof of session intent
- [ ] Every session minted before the reset stops working, via T123. Cover it here with a route
      test, not only in T123's unit tests: this is the pair of tasks whose seam is most likely to
      be wrong
- [ ] The link is built from `config.APP_URL` and points at `/reset-password/[token]`. Mail copy is
      Spanish, plain-text and HTML, states the 30-minute expiry and single use, and contains no
      account detail, no third-party link, and no remote image. It lives in the server-only mail
      copy module, not `src/lib/i18n/es.ts`
- [ ] Route tests: the `202` for known, unknown, and unverified addresses are **byte-identical**;
      mail failure still `202`; either bucket exhausted gives `429`; a used token gives `400`; the
      happy path writes a new hash and moves `sessions_valid_from`
- [ ] `api-contract.md` gains both endpoints and their rate-limit rows, and `security.md` § *Known
      accepted risks* keeps only the 2FA half of its "no 2FA and no password reset flow in v1"
      bullet. [roadmap.md](../../docs/roadmap.md) § E11 already records the question as answered —
      check it still reads correctly once the flow is actually live

## Out of scope

The two pages (T126). The operator script (T128). Changing a password while logged in (T129).
Session-revocation mechanics (T123) — this task triggers it and asserts it, and does not implement
it.

## Files likely touched

```
src/app/api/auth/forgot-password/route.ts
src/app/api/auth/reset-password/route.ts
src/app/api/auth/*/route.test.ts
src/server/mail/templates/password-reset.ts
src/server/mail/copy-es.ts
src/lib/schemas/auth.ts
docs/context/api-contract.md
docs/context/security.md
docs/roadmap.md
```
