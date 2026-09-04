---
id: T132
title: Log when a verification mail is not sent — it currently fails silently
epic: E15-account-recovery
status: done
depends_on: []
size: S
---

## Context

`sendVerificationEmail` in `src/server/services/email-verification.ts` opens with:

```ts
if (!isMailConfigured()) return;
```

It returns **before minting**, logs nothing, and registration reports success. So an instance with
mail misconfigured tells nobody: no token row, no log line, no signal in the UI, and a `204` from
`POST /api/auth/resend-verification` that is indistinguishable from a delivered message.

The reset path, written from the same ADRs, handles the identical situation correctly — it mints,
then warns and names the recovery script:

```ts
console.warn("password reset token minted but mail is not configured — deliver it with `npm run reset-link`", { userId })
```

**This is not theoretical.** On 2026-09-04 the production container was missing all five `MAIL_*`
variables (the compose file on the host predated T120 — since fixed by T130). Verification silently
sent nothing for the entire time. Diagnosing it required inspecting the container's environment and
querying `auth_tokens`, because the app emitted nothing at all. `T124`'s criteria required the
unconfigured and failed-send cases to be logged, and
[ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md) is explicit that server-side logging is
the *only* signal that a broken mail config has silently disabled recovery — the endpoints
deliberately cannot tell the caller anything.

Read ADR-0011 § *Consequences*, [ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md)
§ *Consequences*, and `src/server/services/password-reset.ts` for the shape to match.

## Acceptance criteria

- [x] The unconfigured-mail branch logs at **warn** before returning, naming the user id and the
      fact that verification could not be delivered. No email address, no token, no link
- [x] The two failure modes stay distinguishable in the log — *not configured* and *send threw* are
      different operational problems with different fixes, and a shared line defeats the purpose
      (ADR-0013 § *Consequences* makes this the sole diagnostic for the whole flow)
- [x] Match the reset path's shape, including pointing at the operator escape hatch: an unverified
      member cannot self-serve recovery, so the useful instruction is that `npm run reset-link`
      still works for them
- [x] Decide and record whether the unconfigured branch should mint a token before returning, as
      the reset path does. **Decided: it does not mint**, and the reasoning is now a comment at the
      divergence rather than an accident. A reset token minted without mail is still deliverable —
      `scripts/reset-link.ts` hands it over. *Nothing delivers a verification link*, so a token
      minted here is a row nobody can ever redeem. The member is not stranded either way, because
      ADR-0013 keeps recovery open to an unverified account through that same operator script
- [x] Tests: with mail unconfigured, registration still succeeds, and the warn fires exactly once;
      with a throwing transport, the send-failure branch logs and registration still succeeds. Both
      already have fixtures from T124 — extend rather than duplicate
- [x] No change to any status code, response body, or the rule that these endpoints reveal nothing
      to the caller

## Out of scope

Structured logging, a log framework, or log levels anywhere else in the app. Surfacing mail health
in the UI or an admin endpoint. Any change to the reset path, which is already correct. Retrying or
queueing sends.

## Files likely touched

```
src/server/services/email-verification.ts
src/server/services/email-verification.test.ts
```
