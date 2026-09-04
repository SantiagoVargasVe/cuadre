# ADR-0011 — Outbound email over SMTP, provider chosen by config

**Status:** Accepted · 2026-09-03

## Context

This app has never sent an email, and [security.md](../context/security.md) § *Privacy* currently
states the reason it doesn't have to: *"No third party is in the request path. The single outbound
dependency is one FX call a day, which carries no user data."* The published Privacy Policy says
the same thing in Spanish.

[ADR-0012](0012-password-reset-via-single-use-token.md) needs to deliver a link to someone who by
definition cannot log in, and [ADR-0013](0013-email-verification-gates-recovery.md) needs to prove
an address is controlled by the person who typed it. Both need a mail channel, and so would
`T094` if notifications ever happen. So the question isn't "how do we send a reset link" — it's
what this app's outbound mail dependency looks like, and what it costs the privacy posture above.

Two constraints shape the answer. This is **self-hosted software** (non-negotiable 11): whoever
runs it picks their own infrastructure, and baking in one vendor makes that choice ours instead of
theirs. And it is **trip-scale**: a few people, a few groups, a handful of messages a month with
long stretches of zero.

## Decision

One `src/server/mail/` module exposing `sendMail({ to, subject, text, html })` and
`isMailConfigured()`, implemented over **SMTP** via `nodemailer`. The provider is entirely a matter
of configuration:

```
MAIL_SMTP_HOST · MAIL_SMTP_PORT · MAIL_SMTP_USER · MAIL_SMTP_PASS · MAIL_FROM
```

All five are **optional** in `config.schema.ts` — but they are optional *as a set*. Unset means the
app boots normally with email disabled; a half-set (a host with no password) fails at boot with a
message naming what's missing, the same way `AUTH_SECRET` and `DEFAULT_CURRENCY` already do. A
mailer that is broken in a way nobody discovers until the one send that matters is the failure
mode this rules out.

**Resend is the reference provider** — what the flow is developed against and what `.env.example`
documents. Nothing in the code knows that.

## Why SMTP rather than a vendor SDK

Every candidate speaks SMTP: Resend, Brevo, Mailgun, SES, Postmark, and a plain company mail
server are all reachable with the same five settings, so the provider stays a `.env` edit.
Reaching for a vendor SDK would turn that into a code change, a new dependency, and a rewrite of
the send path — for an API surface we use exactly one call of. The things SDKs buy at scale (batch
sending, webhook helpers, templating, typed events) do not apply at a few messages a month.

Self-hosting an MTA was considered and rejected. Deliverability is a reputation problem, not a
configuration one — consumer ranges are widely blocklisted, many block outbound port 25, and mail
without SPF/DKIM/DMARC history lands in spam. A reset that silently goes to spam is worse than no
reset flow, because the person locked out has no signal that anything went wrong. Delivery is
exactly the part worth outsourcing.

## What this costs the privacy posture, and what it doesn't

An email address now leaves the box, to one processor, on three occasions: registration
(verification), a reset request for a verified address, and an explicit resend. Nothing else goes
with it — no group name, no member list, no amount, no balance. The mail bodies in
[ADR-0012](0012-password-reset-via-single-use-token.md) and
[ADR-0013](0013-email-verification-gates-recovery.md) are a link and an expiry, deliberately.

That is still a real change to a published promise, so it is not a code-only decision:
`security.md` § *Privacy* and the hosted Privacy Policy both have to say it before the first send
ships. The Terms say something now false as well — they currently promise that Cuadre neither
verifies email nor offers automatic recovery. `T121` owns that copy, and `T124` (the first task
that actually sends) depends on it.

Existing users are **not** re-prompted to acknowledge the new versions. `T118` deliberately built
no re-acknowledgement flow, its natural key retains prior-version records, and inventing one here
would be a second feature smuggled into a recovery epic.

## Dependency

`nodemailer` joins the intended set in [architecture.md](../context/architecture.md)'s dependency
policy. It is the de-facto standard SMTP client for Node, has no native build step, and is
imported only from `src/server/mail/` — never from `src/app/`, like the DB.

## Consequences

- **Email is optional, everywhere.** Any feature built on it degrades rather than breaks when the
  config is absent. For recovery that means `scripts/reset-link.ts` (`T128`) is a first-class
  supported path, not an emergency hack: an operator who wants no third-party mail vendor is a
  supported configuration.
- **The five keys must be added to the `environment:` block in `infra/docker-compose.prod.yml`.**
  That block is an allowlist — a key sitting in the host's `.env` does not reach the container
  unless it is named there, and a value change needs `--force-recreate`. This has bitten the
  sibling repo before; it is the single most likely way this ships and silently sends nothing.
- **Send failures are invisible to the caller by design.** `/api/auth/forgot-password` returns the
  same `202` whether or not mail went out, because telling those apart tells an attacker whether an
  address is registered. Server-side logging is therefore the *only* signal that a bad API key has
  quietly disabled recovery. Log failures loudly — with the recipient domain, never the address,
  never the token.
- **Mail is sent inside the request**, awaited with a short timeout so a hanging SMTP connection
  can't pin a route handler. At this volume a queue would be ceremony. Revisit if volume or
  latency ever changes.
- `.env.example` gains the five keys with dummy values, per the secrets rule in
  [security.md](../context/security.md).
