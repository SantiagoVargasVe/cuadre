---
id: T012
title: Login, logout, me — JWT as cookie and bearer, with the Origin check
epic: E2-auth
status: todo
depends_on: [T010]
size: M
---

## Context

The session mechanism for the whole app. It accepts the token two ways so a native client later
isn't a backend project — and that dual mode is exactly where CSRF gets reasoned about badly
("we use bearer tokens, so CSRF doesn't apply" — the browser is still sending the cookie).

Read [ADR-0003](../../docs/adr/0003-jwt-cookie-and-bearer.md) in full. It is short and every line
of it is a requirement.

## Acceptance criteria

- [ ] `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] HS256 via `jose`, signed with `AUTH_SECRET`
- [ ] Claims are **`sub`, `iat`, `exp` and nothing else.** No email, no display name, and
      **no membership list** — membership changes must take effect immediately
- [ ] Token accepted from the `cuadre_session` cookie **or** `Authorization: Bearer`. One
      `getSession()` reads either; nothing downstream knows which
- [ ] Cookie is `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`
- [ ] **Every state-changing request validates `Origin` against `APP_URL`.** No `Origin` and no
      `Bearer` on a non-`GET` method is a rejection
- [ ] **No `GET` mutates anything.** Add a note wherever this could regress
- [ ] Do **not** add a CSRF token scheme on top. Three overlapping mechanisms nobody fully
      understands is worse than two that are enforced
- [ ] Login is rate limited by IP before the hash is computed
- [ ] Wrong password and unknown email are indistinguishable to the caller
- [ ] Tests: both auth paths accepted; expired token rejected; token signed with a different
      secret rejected; **cross-origin `POST` with a valid cookie is rejected** — this is the
      control most likely to be quietly removed by someone debugging a local CORS problem, so it
      needs a test that names it

## Out of scope

The auth pages (T014), rate-limit infrastructure itself (folded in here — build the token bucket
per [data-model.md](../../docs/context/data-model.md) § *rate_limits*).

## Files likely touched

```
src/app/api/auth/{login,logout,me}/route.ts
src/server/auth/{jwt,session,cookie,origin}.ts
src/server/rate-limit/*.ts
```
