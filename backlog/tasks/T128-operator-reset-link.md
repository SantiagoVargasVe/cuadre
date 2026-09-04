---
id: T128
title: scripts/reset-link.ts — mint a recovery link without email
epic: E15-account-recovery
status: done
depends_on: [T122]
size: S
---

## Context

What keeps [ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md)'s "email is optional" true
for the one feature that would otherwise force a mail vendor. The operator runs it, gets a URL, and
delivers it however they like.

Three audiences, and the third is the one people forget: an operator who deliberately runs no SMTP
provider; an operator whose provider is failing at the moment someone needs to get in; and **any
member whose address predates verification**, who by
[ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md) cannot use `/forgot-password`
at all until they verify. Today the alternative for all three is hand-editing an Argon2 hash into
Postgres, which is worse in every respect.

Follow the shape of the existing `scripts/seed-invite.ts` and `scripts/fx-refresh.ts` — same
argument handling, same output style, same `npm run` wiring, and the same trick for running server
code outside Next: build a connection from `envSchema` rather than importing the `server-only`
`db/client.ts`, then hand it to a core module that takes a `Db`. `fx-refresh.ts` calling
`refreshCore` is the precedent, and T122 is scoped so the same thing works here.

## Acceptance criteria

- [ ] `npm run reset-link -- <email>` prints a ready-to-use absolute URL built from
      `config.APP_URL`
- [ ] Uses T122's `mintToken` unchanged — same table, same expiry, same single-use semantics,
      identical code path to the endpoint the way `fx:refresh` shares `refreshCore` with
      `POST /api/admin/fx/refresh`. If this script needs its own token path, T122 was scoped wrong
- [ ] **Deliberately ignores `email_verified_at`.** An operator minting a link has established
      identity out of band, which is a stronger signal than an inbox round-trip, and this is the
      escape hatch that keeps an unverified member recoverable (ADR-0013). Say so in a comment
- [ ] An unknown email exits non-zero with a clear message. This is an operator tool, not a public
      endpoint, so here it **should** say the address isn't registered — the enumeration rule in
      T125 is about what a stranger can learn over HTTP
- [ ] Prints the expiry time explicitly, so an operator pasting it into a chat knows what they are
      promising, and warns that the link is a credential and single-use
- [ ] Requires no `MAIL_*` configuration and sends nothing
- [ ] Does not print the token hash, and does not log the URL anywhere but stdout
- [ ] Documented in `README.md` beside the invite-seeding script, framed as the supported no-email
      recovery path rather than an emergency hack

## Out of scope

Sending mail (T125). Listing, revoking, or sweeping outstanding tokens. Asserting verification on
someone's behalf — ADR-0013 rules that out as a claim nobody can make for another person. Any
interactive prompt: it must stay usable over a non-interactive SSH command.

## Files likely touched

```
scripts/reset-link.ts
package.json
README.md
```
