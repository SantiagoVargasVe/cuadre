# ADR-0012 — Password reset via single-use tokens, and revocable sessions

**Status:** Accepted · 2026-09-03 · reverses the "no password reset in v1" risk accepted in
[security.md](../context/security.md) · supersedes
[ADR-0003](0003-jwt-cookie-and-bearer.md)'s "there is no per-session revocation"

## Context

Password reset was deferred through v1 because it needed SMTP this repo didn't own, so recovery
has been an operator action — editing a hash into Postgres by hand.
[ADR-0011](0011-outbound-email-via-smtp.md) removes the transport objection.

What makes it worth doing now rather than later is what an account is here. A wishlist account
holds a list of things someone wants. **A Cuadre account holds write access to other people's
money.** Whoever has it can add expenses, re-split existing ones, soft-delete them, and record
settlements that never happened — and because every write is attributed, the group reads all of it
as the victim's own edits. Non-negotiable 7 says shared-money history is the product and a silent
overwrite of who-owed-what is the worst bug this app can have; an account someone else controls is
that bug with a login.

## Decision

An `auth_tokens` table and two endpoints:

```
POST /api/auth/forgot-password  { email }             → 202, always
POST /api/auth/reset-password   { token, password }   → 204
```

**Token.** 32 bytes from `crypto.randomBytes`, base64url, handed to the person in the link. Only
its **SHA-256** is stored, and lookup is by that hash. 30-minute expiry, single use. The table is
shared with email verification via a `purpose` enum — see
[ADR-0013](0013-email-verification-gates-recovery.md).

**Consumption is one statement** — `UPDATE … WHERE used_at IS NULL AND expires_at > now() AND
purpose = … RETURNING user_id` — for exactly the reason invite consumption and the rate limiter
are single statements. A read-then-write lets two concurrent requests both observe an unused token.

**On success:** rehash with Argon2id, mark the token used, delete the user's other outstanding
`password_reset` tokens, and move `users.sessions_valid_from` forward.

## Why SHA-256 for the token when passwords get Argon2id

These look like one problem and are two. Argon2id exists to make a *low-entropy* secret expensive
to guess — a human password has maybe 30 bits, so the defence has to be cost per attempt. A reset
token has 256 bits from a CSPRNG; it is not guessable at any cost per attempt, and a memory-hard
hash would add ~100 ms and ~19 MB to every lookup buying nothing. Storing the hash still matters:
a leaked backup, or a stray `SELECT *` in a log, must not hand over live reset links.

## Why not a JWT

Tempting — `jose` is already here and a signed token with an `exp` needs no table. Rejected
because a JWT cannot be **single-use**. Statelessness is the whole point of a JWT and precisely
the wrong property here: a link that stays valid for its full window after being used is a link
sitting in an inbox, a mail provider's logs, or a forwarded message that still opens the account.
One-shot requires server-side state, so the table isn't overhead we failed to avoid — it is the
requirement.

## Why sessions must become revocable

[ADR-0003](0003-jwt-cookie-and-bearer.md) accepted that "a stolen token is valid until it expires"
and listed database sessions as "worth revisiting if per-session logout is ever wanted". This is
that moment. A meaningful share of resets are someone reacting to a suspicion that another person
has their password. Leaving that person's 30-day cookie working means the flow has done nothing
about the actual problem while strongly implying it has — and here the actual problem is a
stranger writing in a shared ledger.

Rather than a session table, `users.sessions_valid_from timestamptz not null` is compared against
the JWT's `iat`. Tokens minted before the bump stop resolving. One column, no session lifecycle,
no cleanup job, and it generalises to any future "cerrar sesión en todos lados".

**Where the check runs matters as much as the check.** It goes in `getSession(request)`, at the
route boundary — which covers both halves of ADR-0003's dual mode at once, since cookie and Bearer
already resolve through that one function, and covers Server Components too, because
`frontend/CLAUDE.md` makes every page fetch its data through Route Handlers rather than the DB.

It does **not** go in `src/middleware.ts`. Middleware runs on the Edge runtime, where the Postgres
driver cannot follow, and Next's Node middleware runtime would buy a redirect at the price of a
second identical lookup on every navigation. Middleware stays what it is: a cheap crypto-only gate
that decides where to send an unauthenticated visitor. A revoked token passes it and then fails at
the first Route Handler the page calls, so `apiFetchServer` turns a `401` into a redirect to
`/login` rather than an error screen.

**The `iat` granularity trap.** `iat` is whole seconds; a timestamptz is not. Store
`sessions_valid_from` truncated to a whole second — `date_trunc('second', now())` on insert,
`date_trunc('second', now()) + interval '1 second'` on a bump — so the read-time check is a plain
`iat >= sessions_valid_from` with no rounding, and every token issued *during* the revoking second
dies with it. The cost is a sub-second window in which a freshly minted token is not yet valid,
which is why any flow that deliberately keeps someone logged in across a bump (`T129`) must mint
its replacement with `setIssuedAt(sessions_valid_from)` rather than the wall clock.

**The cost is real and stated plainly:** session resolution stops being pure crypto and becomes one
indexed primary-key read on every authenticated request. That is more requests than it would have
been a week ago — `T117` gave every mounted group tab a two-minute poll and restored
refetch-on-focus. Accepted, because those same requests already do a membership check and a data
read against the same connection pool, so this is a third small read on a path that was never
crypto-only in practice; because a session table would be the same read plus more machinery; and
because it is the trade this app already makes everywhere else — nothing is cached in a claim,
precisely so a change takes effect immediately.

## Enumeration, and where it actually leaks

`/api/auth/forgot-password` returns an identical `202` for a registered address, an unknown one,
an unverified one, and a failed send, and does no Argon2 work on any path, so timing doesn't
separate them either.

Worth being honest that this is not airtight: `POST /api/auth/register` returns
`EMAIL_ALREADY_REGISTERED` on the unique violation, which discloses the same fact — and the
register form shows it in Spanish. That path is invite-gated (ADR-0002), so probing it costs an
unused invite code. Closing the reset endpoint's leak is still worth doing rather than levelling
down to the weakest existing behaviour.

## Consequences

- **Two rate-limit policies, and one of them is keyed twice.** `passwordResetRequest` is consumed
  per IP *and* per address — the IP bucket stops a spray across many accounts, the address bucket
  stops mailbombing one person, and neither substitutes for the other. The address is **hashed**
  into the bucket key: `rate_limits` is a table, and a plaintext-email key would turn a limiter
  into a durable list of who was probed. `passwordResetConsume` is per IP; against 256 bits it
  isn't stopping a guess, it's stopping CPU burn.
- **The link carries a credential in the path** (`/reset-password/[token]`), so it reaches logs and
  `Referer` headers. Accepted for the same reason `/join/[code]` already is — the alternative, a
  code the user copies into a form, is materially worse for the least technical member of a group
  — and bounded by single use and 30 minutes. The reset page makes no third-party requests.
- **A successful reset does not log anyone in.** It redirects to `/login`. A link arriving in a
  mailbox is not proof of session intent, and the person has just demonstrated they can type the
  new password.
- The UI cannot say "revisa tu correo", because the server won't confirm the address exists. Copy
  says "si esa dirección está registrada…", Spanish-first and keyed.
- Spent and expired rows accumulate — one per request, never swept. At this scale that is a
  rounding error, and `ON DELETE CASCADE` plus delete-on-consume covers the shape of it.
- `scripts/reset-link.ts` (`T128`) mints the same token from the CLI with no mail involved. That is
  what keeps ADR-0011's "email is optional" true for the one feature that would otherwise force a
  vendor.
