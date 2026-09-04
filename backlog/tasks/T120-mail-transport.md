---
id: T120
title: SMTP mail transport, optional by config
epic: E15-account-recovery
status: done
depends_on: []
size: S
---

## Context

Implements [ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md). One send function over SMTP,
provider selected entirely by env — nothing in the code knows which vendor is behind it.

The property that everything else in this epic leans on is that email is **optional**: unset config
means the app boots normally with mail disabled, and every feature built on top degrades rather
than breaks. An operator running this with no mail vendor is a supported configuration, not a
broken one — which is what makes `scripts/reset-link.ts` (T128) a first-class path.

This is also the task that changes what this app's privacy posture is, so read
[security.md](../../docs/context/security.md) § *Privacy* and § *Secrets*, the dependency policy in
[architecture.md](../../docs/context/architecture.md), and
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md). Nothing in `src/app/` may import this module.

## Acceptance criteria

- [ ] `nodemailer` added as a runtime dependency, pinned, justified in `architecture.md`'s
      dependency policy with a line pointing at ADR-0011
- [ ] `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_USER`, `MAIL_SMTP_PASS`, `MAIL_FROM` added to
      `config.schema.ts`, all optional, using the existing `emptyToUndefined` preprocessing so an
      empty string in `.env` reads as unset — the same treatment `FX_REFRESH_TOKEN` already gets.
      `MAIL_FROM` validates as an email address; `MAIL_SMTP_PORT` coerces to a positive integer
- [ ] Config is **all-or-nothing**: a partially configured mailer (host but no password) fails at
      boot with a message naming exactly what is missing, via the same `.refine` mechanism that
      already cross-checks `DEFAULT_CURRENCY` against `SUPPORTED_CURRENCIES`. A mailer that is
      broken in a way nobody notices until the one send that matters is the failure this prevents
- [ ] `src/server/mail/index.ts` exports `sendMail({ to, subject, text, html })` and
      `isMailConfigured(): boolean`
- [ ] `sendMail` throws a typed error when unconfigured. It must never resolve successfully having
      sent nothing — callers decide how to degrade, and they can only do that if the failure is
      visible to them
- [ ] An explicit connection/send timeout (~10s) so a hanging provider cannot pin a route handler.
      ADR-0011 accepts in-request sending precisely on the condition that it is bounded
- [ ] Failures log at error level with the recipient **domain** only — never the full address,
      never the subject, never a token, never a link. `security.md` § *Privacy* says logs record
      user ids, not emails, and this is the first code that would be tempted to break that
- [ ] **The five keys are added to the `environment:` block in `infra/docker-compose.prod.yml`**,
      with `${VAR:-}` defaults so an operator who runs no mail vendor needs none of them in `.env`.
      That block is an allowlist: a key that is only in the host's `.env` never reaches the
      container. This is the single most likely way this epic ships and silently sends nothing
- [ ] `.env.example` gains all five with dummy values and a comment naming a reference SMTP host,
      phrased so it is clearly an example rather than a requirement
- [ ] `security.md` § *Privacy* updated: there is now one third party that receives a user's email
      address, on registration, reset request, and resend — and receives nothing else. The existing
      "no third party is in the request path" sentence is no longer true as written
- [ ] Unit tests with the transport mocked: a configured send calls through; an unconfigured one
      throws; partial config fails validation; a timeout surfaces as a failure rather than a hang.
      **No test opens a network connection** ([testing.md](../../docs/context/testing.md))

## Out of scope

Message bodies, templates, and i18n of mail copy — T124 and T125 own the two messages they send.
Retries, queueing, bounce handling, a second (HTTP/API) transport, and anything to do with T094
notifications. Do not update the hosted legal documents here; T121 owns that copy and needs
approval on its own timeline.

## Files likely touched

```
src/server/mail/index.ts
src/server/mail/index.test.ts
src/server/config.schema.ts
src/server/config.schema.test.ts
infra/docker-compose.prod.yml
.env.example
package.json
docs/context/architecture.md
docs/context/security.md
```
