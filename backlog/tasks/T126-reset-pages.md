---
id: T126
title: /forgot-password and /reset-password/[token] pages
epic: E15-account-recovery
status: done
depends_on: [T125]
size: M
---

## Context

The user-facing half of recovery: two pages in the existing `(auth)` route group, matching `login`
and `register` — same layout, same `react-hook-form` + `zodResolver` + `apiFetch` pattern, same
`TextField`/`Button` primitives, same `es.auth.*` copy structure. `LoginForm.tsx` is the model to
follow; there is nothing novel to invent here except the copy.

The copy carries real weight. Because the API will not confirm whether an address is registered
([ADR-0012](../../docs/adr/0012-password-reset-via-single-use-token.md) § *Enumeration*), the
success state has to be honest about that without reading as broken to a relative who is already
locked out and blaming themselves.

**Mandatory:** [design-system.md](../../docs/frontend/design-system.md) before writing any
component, and [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *i18n*. Note the ≤100-line
rule — two forms plus their states means composition, not one long file.

## Acceptance criteria

- [ ] `/forgot-password` — email field, submit, and a success state reading as "si esa dirección
      está registrada, te enviamos un enlace", **never** "revisa tu correo"
- [ ] The same page notes that recovery needs a verified address and links to the verification
      resend, since this is exactly where an unverified member hits a wall they cannot otherwise
      see (ADR-0013). Word it as a condition of the flow, not as an error they have made
- [ ] `/reset-password/[token]` — new password plus confirmation, validated client-side against the
      same Zod rules the API enforces, reusing `src/lib/schemas/auth.ts` rather than restating the
      minimum length
- [ ] An invalid or expired token renders a clear way forward — a link back to `/forgot-password` —
      not a dead end and not a raw error code
- [ ] On success, redirect to `/login` with a confirmation message. The user is deliberately not
      logged in (T125), and the copy should make that read as intentional
- [ ] A "¿Olvidaste tu contraseña?" link on `/login`. Without it the flow is unreachable, which is
      the most likely way this entire epic ships and goes unused
- [ ] The reset page makes **no third-party requests** — no fonts, no analytics, no remote images.
      The URL contains a live credential and must not reach a `Referer` header
- [ ] Submit is disabled while in flight and after success, so a double submit cannot burn the token
- [ ] All copy through `es.auth.*` i18n keys, Spanish-first, including a keyed message per error
      code the way `es.auth.login.errors` already does. No hardcoded user-facing strings
- [ ] Usable at 375px, keyboard reachable, errors announced — the same bar the login and register
      forms already meet
- [ ] Component tests in the `LoginForm.test.tsx` pattern: validation errors, the ambiguous success
      state, the expired-token state, in-flight disabling, and the link from `/login`

## Out of scope

Endpoints (T125). The verification page and prompt (T127). Password-strength meters, "remember me",
and any change to the login or register forms beyond adding the one link.

## Files likely touched

```
src/app/(auth)/forgot-password/page.tsx
src/app/(auth)/forgot-password/ForgotPasswordForm.tsx
src/app/(auth)/reset-password/[token]/page.tsx
src/app/(auth)/reset-password/[token]/ResetPasswordForm.tsx
src/app/(auth)/login/LoginForm.tsx
src/lib/i18n/es.ts
```
