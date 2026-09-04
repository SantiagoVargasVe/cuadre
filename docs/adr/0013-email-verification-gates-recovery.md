# ADR-0013 — Email verification gates recovery, not login

**Status:** Accepted · 2026-09-03 · reverses the "no email verification" risk accepted in
[security.md](../context/security.md)

## Context

[security.md](../context/security.md) § *Known accepted risks* records the current position:

> **No email verification.** Registration is invite-gated, which is the control. A wrong email is a
> lockout risk for the user, not an abuse vector.

That was true, and [ADR-0012](0012-password-reset-via-single-use-token.md) makes it false. Once a
public endpoint mails a credential to whatever address is on the account, a mistyped address stops
being the typist's problem and becomes someone else's opportunity: the person who actually owns
`ana@gmial.com` doesn't have to wait for an accident, they can request a reset whenever they like.
Shipping recovery on unverified addresses doesn't inherit a pre-existing gap — it builds a
takeover path and calls it a feature. And per ADR-0012, taking over an account here means writing
in other people's ledger under their name.

## Decision

`users.email_verified_at`, nullable. Registration sends a verification email and the account is
created and **immediately usable**. Verification gates exactly one thing:

**`/api/auth/forgot-password` sends nothing to an unverified address** — same `202`, no token
minted, no mail.

It gates nothing else. Not login, not the join flow, not any endpoint, not any UI beyond a
dismissible prompt. Verification tokens reuse ADR-0012's `auth_tokens` table via
`purpose = 'email_verify'`, with a 24-hour expiry rather than 30 minutes.

## Why verification does not block login

Blocking login is the reflex, and it is wrong here three times over.

**It would lock out every existing account on deploy.** Every current row is unverified by
definition. A gate on login turns a security improvement into an outage for exactly the people it
is meant to protect.

**It would break the flow this product is most careful about.** An invite link is how someone
joins a trip: accept, register, land in the group, start adding expenses — usually while standing
in the same room as the person who sent it. [roadmap.md](../roadmap.md) calls that "the flow most
likely to be subtly broken in production" and shipped M2 early specifically to protect it. Putting
an inbox round-trip between the invite and the group is exactly the breakage it was protecting
against.

**It would make email a hard dependency.** [ADR-0011](0011-outbound-email-via-smtp.md) makes
outbound mail optional on purpose; an operator running this with no SMTP provider is supported. If
login needed a verification mail, that configuration would stop booting a usable app and ADR-0011
would become a fiction.

It also doesn't match the threat. Someone who knows their own password has demonstrated they are
who they claim by ordinary means. The dangerous object is a *reset link* sent to a mailbox the
account holder may not control. Gate that, and nothing else — a control that blocks a safe action
to prevent an unrelated dangerous one is friction with a security-sounding name.
[ADR-0002](0002-invite-only-registration.md) already answers "is this person allowed in";
verification answers a different question, "does this person control this mailbox", and only
recovery depends on the answer.

## Why one token table with a `purpose` column

Both tokens are the same object: a high-entropy secret, stored hashed, bound to a user, expiring,
single-use. They share the atomic-consume statement that is the most security-sensitive and most
easily-got-wrong part of ADR-0012, and writing it twice means maintaining two chances to get it
wrong. The table is named `auth_tokens` rather than `password_reset_tokens` because it holds both
from its first migration — there is no history to be honest about, so the name should be.

`purpose` is a `pgEnum`, matching `legal_document` and `split_strategy` rather than the
text-plus-CHECK the sibling repo used. Postgres rejects an unknown value either way; an enum also
makes it a type in Drizzle instead of a string a caller can typo.

The honest counter-argument is that a discriminator invites per-purpose columns later — a
different expiry policy, multi-use semantics. If that day comes, split the table then. Splitting a
two-purpose table is a mechanical migration; reconciling two subtly different consume
implementations is not.

**The risk the shared table introduces is cross-purpose redemption**, and it is the one thing that
would make this decision wrong: a verification token accepted by `/api/auth/reset-password` would
let anyone who can read a verification mail set a password. `purpose` is therefore part of the
consume statement's `WHERE`, not checked afterwards in TypeScript, and both directions get a test.

## Existing accounts are not backfilled

The tempting move is `UPDATE users SET email_verified_at = now()` and a note in the PR. Rejected:
a blanket backfill marks a possibly-mistyped address as verified, which is precisely the state
this ADR exists to prevent. It would close the hole for new accounts and cement it for old ones.

`T118` set a nearby precedent that deliberately does not apply. Its migration backfilled legal
acknowledgements for existing rows with `source = 'legacy_backfill'` — a recorded *product
decision by the operator about their own instance*, honestly labelled as such. "This address is
verified" is not a decision anyone can make on someone else's behalf; it is a claim about the
world that nobody checked.

Existing rows stay null, and **nobody is locked out**, because verification doesn't gate login.
The only thing an unverified member cannot do is self-serve a password reset, and
`scripts/reset-link.ts` covers them until they verify.

## Consequences

- **Self-service recovery has a one-time prerequisite for existing users**: verify first. Accepted
  — the alternative is a recovery flow that is quietly unsafe for exactly the accounts that
  predate it.
- **`scripts/reset-link.ts` deliberately ignores verification.** An operator minting a link has
  established identity out of band, which is a stronger signal than an email round-trip, and it is
  the escape hatch that keeps an unverified member recoverable.
- **`/forgot-password` now has three silent no-send cases** — unknown address, unverified address,
  and send failure — all returning the same `202`. Server-side logging is the only way to tell them
  apart, so each must log distinctly. ADR-0011 already says to log send failures loudly; this
  widens that from a nicety to the sole diagnostic for the whole flow.
- **Verification status is private.** `GET /api/auth/me` is the only endpoint that may expose it,
  for the caller's own account, exactly as it is the only endpoint that returns an email
  (security.md § *Privacy*). No group read gains a "verified" badge — whether a co-member has
  confirmed their inbox is none of the group's business.
- The verify endpoint is unauthenticated and consumes a token, so it needs its own rate limit
  alongside the reset policies; resend is authenticated and limited per user.
