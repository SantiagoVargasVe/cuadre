---
id: T129
title: Change your password from /cuenta
epic: E15-account-recovery
status: done
depends_on: [T122, T123]
size: M
---

## Context

`/cuenta` has shipped a **disabled** "Cambiar contraseña" button since T109, with a comment
explaining that the flow needs a mail story the deployment doesn't have. This epic supplies that
story, and by the time T122 and T123 land the actual work is one endpoint and one form: the
password write, the Argon2 hash, and the session bump all already exist.

It is last in the epic on purpose. Recovery is for people who *cannot* log in, and that is the part
worth shipping first; this is for someone who can. It is also the one task here that can be dropped
without leaving anything half-built — if it is deferred, the button stays disabled and honest.

The interesting requirement is the session one. Changing a password revokes every session
([ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md)), including the one making
the request, so this route must mint a replacement — and mint it correctly, which is where the
`iat` rule bites.

Read ADR-0012 § *Why sessions must become revocable* and its `iat` granularity paragraph,
[security.md](../../docs/context/security.md) § *Authentication*, and
[design-system.md](../../docs/frontend/design-system.md).

## Acceptance criteria

- [ ] `POST /api/auth/change-password` — authenticated, Origin-checked, Zod-validated
      `{ currentPassword, newPassword }`. The new password is held to registration's rules by
      reusing the shared schema, not by restating the minimum
- [ ] The current password is **required and verified** before anything is written. A wrong one is
      `401 INVALID_CREDENTIALS`, indistinguishable from a wrong password at login
- [ ] Rate limited per user, not per IP — Argon2 runs twice here (verify then hash), and the caller
      is authenticated so there is a better key than their address
- [ ] On success: write the new hash, move `sessions_valid_from` forward, and delete the user's
      outstanding `password_reset` tokens — someone who just proved they know their password should
      not leave a live reset link in an inbox
- [ ] **The response re-establishes the caller's own session.** It mints a replacement token with
      `setIssuedAt(sessions_valid_from)` — not the wall clock — so the token is valid at the new
      boundary rather than dying to the same bump that revokes everything else. Test that the
      caller's next request succeeds and that a token captured before the change does not
- [ ] Every other session is revoked. Cover it with a route test that resolves a second, older
      token afterwards
- [ ] The `/cuenta` Seguridad section becomes real: current password, new password, confirmation,
      inline success and error states, submit disabled while in flight. Remove the placeholder
      comment and the disabled button rather than leaving either in place
- [ ] Spanish copy through i18n keys, usable at 375px, errors announced
- [ ] Tests: happy path; wrong current password; new password failing validation; rate limit;
      other sessions revoked; the caller's own session survives; a `password_reset` token issued
      before the change no longer works

## Out of scope

Changing an account's email address — deliberately not in this epic (see the E15 note in
[backlog/README.md](../README.md)). A "cerrar sesión en todos lados" control, 2FA, password
strength meters, and password history/reuse rules. Any change to the reset flow.

## Files likely touched

```
src/app/api/auth/change-password/route.ts
src/app/api/auth/change-password/route.test.ts
src/server/services/auth.ts
src/lib/schemas/auth.ts
src/server/rate-limit/policies.ts
src/app/(app)/cuenta/_components/SecuritySection.tsx
src/app/(app)/cuenta/_components/ChangePasswordForm.tsx
src/lib/i18n/es.ts
docs/context/api-contract.md
```
