---
id: T127
title: Verification UI — /verify-email/[token], shell prompt, /cuenta status
epic: E15-account-recovery
status: todo
depends_on: [T124]
size: M
---

## Context

Makes verification visible and actionable. Per
[ADR-0013](../../docs/adr/0013-email-verification-gates-recovery.md) an unverified member keeps
full use of the app — the only thing they lose is self-service password reset. So this is a prompt,
never a wall, and the copy has to say what verifying actually buys without implying the account is
broken.

The prompt matters more than it looks. Unverified state that nobody can see is a gap nobody can
close, and the whole epic's safety story depends on people actually verifying. It also has to stay
cheap: the shell already runs one `["me"]` TanStack query in `UserMenu`, and the verification flag
rides along on that response (T124) — this must not add a second round-trip per page.

**Mandatory:** [design-system.md](../../docs/frontend/design-system.md) before writing any
component, plus [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *i18n* and § *Responsive*.
Mind the ≤100-line rule.

## Acceptance criteria

- [ ] `/verify-email/[token]` in the `(auth)` group: consumes the token on load, shows success or a
      clear failure with a resend action. Never a dead end. It works for a logged-out visitor —
      people open mail on a device they haven't signed in on
- [ ] A dismissible prompt for signed-in unverified users, reading from the existing `["me"]` query
      rather than a new fetch. Dismissal persists for the session, not forever — it should come
      back
- [ ] The prompt does **not** block, overlay, or gate any part of the app. If it cannot be
      dismissed and worked around, it is wrong
- [ ] Copy states the actual consequence — that recovering a forgotten password needs a verified
      address — rather than a generic "verifica tu correo". Someone should be able to make an
      informed decision to ignore it
- [ ] The `/cuenta` Seguridad section shows verification state and the resend control. That section
      exists today as a deliberately inert placeholder whose comment says the flow needs a mail
      story the deployment doesn't have; this is half of that debt (T129 is the other half). Update
      the comment or drop it — do not leave it claiming something untrue
- [ ] Resend is disabled while in flight and after success, and surfaces the `429` from
      `verificationResend` as a Spanish "intenta más tarde" rather than a generic failure
- [ ] Verification state is never rendered for anyone but the signed-in user — no badge in a member
      list, no marker on an expense row (ADR-0013)
- [ ] All copy through i18n keys, Spanish-first. Usable at 375px
- [ ] Component tests in the existing form-test pattern: success, expired token, resend success,
      resend rate-limited, dismissal and its return, and that a verified user sees no prompt

## Out of scope

The endpoints (T124). Any change to login, registration, or the join flow beyond the prompt. An
operator view of who is verified. Changing an account's email address.

## Files likely touched

```
src/app/(auth)/verify-email/[token]/page.tsx
src/app/(auth)/verify-email/[token]/VerifyEmailPanel.tsx
src/app/_shell/VerifyEmailPrompt.tsx
src/app/_shell/VerifyEmailPrompt.test.tsx
src/app/(app)/layout.tsx
src/app/(app)/cuenta/_components/SecuritySection.tsx
src/lib/i18n/es.ts
```
