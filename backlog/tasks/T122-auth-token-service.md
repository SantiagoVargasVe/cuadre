---
id: T122
title: Auth token service — mint, purpose-bound atomic consume, rate-limit policies
epic: E15-account-recovery
status: todo
depends_on: [T119]
size: M
---

## Context

The domain half of [ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md) and
[ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md), with no HTTP and no email in
it — so the reset endpoints (T125), the verification endpoints (T124) and the operator script
(T128) all sit on the same primitives and cannot drift apart.

Three details are the whole task and each is easy to get subtly wrong:

1. The token is stored as a **SHA-256, not Argon2**. Read ADR-0012 § *Why SHA-256* — it is not an
   oversight.
2. **Consumption is one statement**, for exactly the reason `consumeInvite` and the rate limiter
   are one statement. A read-then-write lets two concurrent requests both observe an unused token.
3. **`purpose` belongs in that statement's `WHERE`**, never in a TypeScript check afterwards.
   Cross-purpose redemption is the one failure mode the shared table introduces, and a
   verification token accepted by the reset path would let anyone who can read a verification mail
   set a password.

Read both ADRs, [security.md](../../docs/context/security.md) § *Authentication*, and
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md). Follow the shape of
`src/server/services/invites.ts` — it already does the conditional-update-returning pattern this
task needs.

## Acceptance criteria

- [ ] The mint/consume core takes a Drizzle handle and carries **no `server-only` guard**,
      following `src/server/fx/refresh-core.ts` and `consumeInvite(tx, …)`. `scripts/reset-link.ts`
      (T128) has to run outside Next, and the alternative — a second mint implementation in the
      script — is exactly what T128's "if this needs its own token path, T122 was scoped wrong"
      criterion forbids. Anything that needs `password.ts` (which is `server-only`) composes on top
- [ ] `mintToken(db, userId, purpose)` returns the **plaintext** token exactly once and stores only
      its SHA-256. 32 bytes from `crypto.randomBytes`, base64url. The plaintext is never logged,
      never persisted, and never returned by a second call
- [ ] Minting invalidates the user's other outstanding tokens **of the same purpose** and leaves
      the other purpose alone — someone mid-verification who asks for a reset must not lose either
- [ ] `consumeToken(db, token, purpose)` claims the row with a single
      `UPDATE … SET used_at = now() WHERE token_hash = … AND purpose = … AND used_at IS NULL AND
      expires_at > now() RETURNING user_id`. A read-then-write is the bug this criterion exists to
      prevent
- [ ] Invalid, expired, already-used, unknown, and wrong-purpose tokens are indistinguishable to
      the caller: one error type, one message, no `details`
- [ ] `resetPassword(token, newPassword)` composes on top: claim the token, write the new Argon2id
      hash, delete the user's remaining `password_reset` tokens, and move `sessions_valid_from` to
      `date_trunc('second', now()) + interval '1 second'` — **all in one transaction**. A crash
      must not leave a spent token with the old password still working
- [ ] Argon2 hashing happens **outside** that transaction, as `register` already does. ~100 ms and
      ~19 MB must not pin a pooled connection
- [ ] `markEmailVerified(token)` claims an `email_verify` token and sets `users.email_verified_at`
      in one transaction. Re-verifying an already-verified account is a no-op success, not an error
- [ ] Expiries are named constants, not literals at call sites: 30 minutes for `password_reset`,
      24 hours for `email_verify`. A verification mail sitting in an inbox overnight is normal; a
      reset link sitting overnight is not
- [ ] New entries in `src/server/rate-limit/policies.ts`, following the existing style of a comment
      saying *why* each number: `passwordResetRequest` (~3/hour), `passwordResetConsume`
      (~10/15min), `emailVerifyConsume` (~10/15min), `verificationResend` (~3/hour)
- [ ] A helper builds the per-address bucket key from a **hash** of the normalized address, never
      the address itself. `rate_limits` is a table: a plaintext-email key would turn the limiter
      into a durable record of who was probed, which `security.md` § *Privacy* rules out
- [ ] Real-Postgres integration tests (`DATABASE_URL_TEST`): happy path per purpose; second use of
      the same token fails; expired fails; **a concurrent double-consume yields exactly one
      success**; a `password_reset` token rejected by the verify path and an `email_verify` token
      rejected by the reset path, **both directions**; sibling tokens of the same purpose are gone
      after a mint and after a consume; `sessions_valid_from` moved forward past the previous value

## Out of scope

HTTP routes, Zod schemas, sending mail, and the enumeration-safe response shape (T124, T125).
Reading `sessions_valid_from` at session-resolution time (T123) — this task only writes it. Any
sweep of spent rows.

## Files likely touched

```
src/server/auth/tokens.ts            # mint/consume core — no server-only guard, takes a Db
src/server/auth/tokens.test.ts
src/server/services/password-reset.ts
src/server/services/password-reset.test.ts
src/server/rate-limit/policies.ts
src/server/errors.ts
```
