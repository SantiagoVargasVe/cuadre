# Security

This app holds a private ledger of who owes whom money. The threat model is not a botnet — it's
one curious person with a link, and the accidental leak of one group's data to someone outside it.

Nothing here fetches user-supplied URLs, so the sibling wishlist app's SSRF surface does not exist
in this repo. **The highest-risk surface here is authorization**, and it is boring, repetitive,
and easy to forget in exactly one place.

## Membership is the authorization model

There is no global role. Access to anything group-scoped is decided by one question: *is the
acting user a current member of the group this row belongs to?*

**Every service that reads or writes group-scoped data takes the acting `userId` and verifies
membership inside the service.** Not in the route handler. Not in a middleware. In the service,
every time, including on read paths and including for resources addressed by their own id.

```
requireMembership(groupId, userId)      → throws NotFoundError if not a current member
requireOwner(groupId, userId)           → throws ForbiddenError if member but not owner
```

`removed_at IS NOT NULL` is not a member. A removed member loses access immediately; their
historical rows stay in the ledger.

**Resources addressed by their own id are the trap.** `GET /api/expenses/:id` and
`PATCH /api/settlements/:id` do not carry a group id in the URL. Load the row, read *its*
`group_id`, then check membership against that. A UUID being unguessable is not an authorization
check — it's an obstacle, and the one place someone pastes an id into a chat is the one place it
stops being unguessable.

**Non-membership returns `404`, not `403`.** Groups are private; there is no reason to confirm one
exists to an outsider. `403` means "you're inside, but this needs `owner`". See
[api-contract.md](api-contract.md).

## Authentication

- **Argon2id** via `@node-rs/argon2`. Deliberately expensive (~50–100 ms, ~19 MB), which is why
  login and register are rate limited by IP before the hash is ever computed.
- **JWT via `jose`**, HS256, signed with `AUTH_SECRET` (32+ chars, validated at boot). Claims are
  `sub`, `iat`, `exp` and nothing else — no display name, no email, no membership list. Membership
  changes must take effect immediately, and a claim baked into a token doesn't.
- Rotating `AUTH_SECRET` logs everyone out and breaks nothing else. That's the intended recovery
  action.
- Registration requires separate Terms and Privacy acknowledgements at the route boundary. The
  service inserts the server-owned current versions and database timestamp in the same transaction
  as the account and invite; it never trusts client-supplied legal metadata.

### The cookie/bearer dual mode, and its one real risk

The API accepts the token as an httpOnly cookie *or* a `Bearer` header
([ADR-0003](../adr/0003-jwt-cookie-and-bearer.md)). The bearer path adds no new risk. **The cookie
path adds CSRF**, and accepting both is exactly where people get this wrong.

Required, all three:

1. Cookie is `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. `Lax` alone blocks cross-site
   `POST`, which is most of it.
2. **Every state-changing request validates `Origin`** against `APP_URL`. Requests with no
   `Origin` and no `Bearer` are rejected on non-`GET` methods.
3. `GET` never mutates. Not "shouldn't" — a `GET` that changes state defeats both of the above.

Do **not** add a CSRF token scheme on top of this without removing something; three overlapping
mechanisms that nobody fully understands is worse than two that are enforced.

## Invite codes

- 16-char nanoid. At that length, enumeration is not the attack — but the lookup endpoint is
  unauthenticated, so rate limit it by IP anyway.
- `GET /api/invites/:code` returns **only** the group title, the inviter's display name, and
  validity. No member list, no expense count, no ids, no email addresses. Someone with a leaked
  code learns a trip's name; that's the accepted floor.
- **Consumption is atomic** with user creation and the membership insert. Check-then-insert races
  two people onto one single-use code. Consume with a conditional `UPDATE … WHERE consumed_at IS
  NULL RETURNING`, and treat zero rows as `409`.
- Expired codes (`expires_at`) and consumed codes are indistinguishable in the response — both are
  "invalid".

## Money integrity

Authorization protects who can see the ledger. These protect what the ledger says.

- **Never trust a client-computed split.** The client sends a *strategy* and its inputs; the
  server resolves the amounts. Even for `strategy: "exact"`, where the client supplies numbers,
  the server validates they sum to the total and rejects otherwise — it does not adjust them.
- **Never trust a client-supplied resolved total.** `total` is validated against the payers and
  splits, not the other way around.
- The balanced-expense constraint is enforced by a deferred database trigger, so no future code
  path can write an unbalanced expense even if it skips the service.
  See [data-model.md](data-model.md).
- Rates are parsed from decimal **strings** to scaled integers. A `parseFloat` anywhere in the FX
  path is a bug, and it's the kind that produces numbers that look right.

## Secrets

- `.env` is never committed; `.env.example` is, with empty values and generation commands.
- `AUTH_SECRET` and `FX_REFRESH_TOKEN` are 32+ chars, generated with `openssl`, validated at boot.
  A short or missing secret fails startup with a message naming it — it never falls back to a
  default.
- `FX_REFRESH_TOKEN` is compared in **constant time**. Unset disables the endpoint with a `404`
  rather than leaving it open.
- Password hashes, tokens, and rate-limit keys never appear in logs.

## Input handling

- Zod validates every request body at the route boundary, before a service sees it.
- Money arrives as a string and is parsed to `bigint` with an explicit digits-only check. A
  string like `"1e9"` or `"  12 "` is rejected, not coerced.
- Free-text fields — group title, description, expense title, settlement note — are length-capped
  (titles 200, descriptions 2000, notes 500) and stored as-is. React escapes on render; never
  build HTML from them, and never introduce `dangerouslySetInnerHTML` in this repo.
- `expense_date` and `settled_on` are parsed as calendar dates and bounded to a sane range, so a
  fat-fingered year can't produce a group feed spanning four millennia.

## Privacy

- A group's expenses, balances, and member list are visible only to current members.
- Email addresses are **never** returned by any endpoint except `GET /api/auth/me`, for the
  authenticated user's own record. Co-members see display names only.
- Outbound dependencies are limited to two, and only one ever carries user data. The daily FX
  call carries none. When mail is configured ([ADR-0011](../adr/0011-outbound-email-via-smtp.md)),
  an email **processor** receives a member's address and a link — on registration (verification),
  on a reset request for a *verified* address, and on an explicit resend — and nothing else: no
  group name, no member list, no amount, no balance. With `MAIL_*` unset, neither address nor FX
  request leaves the box.
- Logs record user ids, never emails or amounts. A failed mail send logs the recipient **domain**
  only — never the address, the subject, or the link.
- `/terms` and `/privacy` are public, repository-versioned pages. Registration records document
  keys, versions, the database timestamp, and whether the record came from explicit registration or
  the one-time legacy backfill. It does not add IP, user-agent, email, or client-clock evidence.
- The existing unauthenticated rate limiter stores a namespaced IP bucket key. This predates legal
  acknowledgements and is disclosed by the Privacy Policy; T118 adds no new request logging.

## Known accepted risks

Written down so they're decisions rather than oversights:

- **No email verification.** Registration is invite-gated, which is the control. A wrong email is
  a lockout risk for the user, not an abuse vector.
- **No 2FA and no password reset flow in v1.** Reset requires SMTP that this repo deliberately
  doesn't own. Recovery is an operator action.
- **Any member can edit or delete any expense in their group**, including one they didn't create.
  Mitigated by `expense_revisions` recording who changed what, and surfaced in the UI as an
  "edited" marker. Groups are people who are already travelling together; permissions would be
  friction against the actual failure mode, which is honest mistakes.
- **`CF-Connecting-IP` is trusted for rate limiting.** True only because the container is
  reachable exclusively through the tunnel. If it is ever exposed on the LAN or port-forwarded,
  that header becomes attacker-controlled and every IP-keyed limit becomes bypassable. Note this
  at the point of use.
- **Rate limiting fails open** on a storage error, with a log. A limiter outage should not take
  the site down — and the database being unavailable already breaks login.
- **The app takes no responsibility for backups.** Unlike a wishlist, this data cannot be
  reconstructed from anything. That's an operator obligation, stated in
  [architecture.md](architecture.md), not something the app pretends to solve.
