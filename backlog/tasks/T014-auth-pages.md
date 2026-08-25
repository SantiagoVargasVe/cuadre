---
id: T014
title: /login and /register pages
epic: E2-auth
status: todo
depends_on: [T012, T004]
size: M
---

## Context

The first real UI. `/register` reads an invite code from `?code=`, which is how every user arrives
— nobody types one in by hand.

Read [design-system.md](../../docs/frontend/design-system.md) and
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Routes*.

## Acceptance criteria

- [ ] `/login` and `/register`, react-hook-form + Zod, schemas shared with the API
- [ ] `/register` prefills `inviteCode` from `?code=` and keeps the field visible and editable
- [ ] All copy through i18n keys, Spanish-first. **No hardcoded user-facing strings** — even with
      one locale, retrofitting is miserable
- [ ] `/` redirects: logged in → `/groups`, otherwise → `/login`
- [ ] Errors from the API render against the right field where possible; `409` on the invite code
      reads as "invalid or already used" — matching the deliberate ambiguity from T011
- [ ] Submit disabled while invalid or in flight
- [ ] Works at 375px. Verified, not assumed
- [ ] Tests: valid submit calls the endpoint with the right payload; a field error renders against
      its field; the `?code=` prefill works

## Out of scope

`/join/[code]` (T023 — it needs the public invite lookup). `/groups` (T062).

## Files likely touched

```
src/app/(auth)/login/page.tsx
src/app/(auth)/register/page.tsx
src/app/page.tsx
src/lib/i18n/es.ts
```
