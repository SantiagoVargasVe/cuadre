# ADR-0003 — JWT accepted as an httpOnly cookie or a Bearer token

**Status:** Accepted · 2026-08-25

## Context

The web app wants an httpOnly cookie: it's immune to XSS token theft, it needs no client storage
code, and it works with Server Components without threading a token through.

A future native client wants a Bearer token: mobile apps have no cookie jar worth relying on, and
`Authorization` is what every HTTP client on those platforms expects.

[ADR-0001](0001-nextjs-fullstack-monolith.md) kept the backend inside the Next app partly on the
premise that a native client later wouldn't force a rewrite. This is the decision that has to make
that true.

## Decision

One JWT, HS256 via `jose`, signed with `AUTH_SECRET`. Accepted from **either** the `cuadre_session`
httpOnly cookie or an `Authorization: Bearer` header. Same token, same claims, same expiry.

Claims are `sub`, `iat`, `exp` — nothing else. No display name, no email, and **no membership
list**: membership changes must take effect immediately, and a claim baked into a token doesn't.

## The risk this introduces, and how it's handled

Accepting Bearer adds no new risk. **The cookie adds CSRF**, and an API that accepts both is
exactly where this gets done badly — a developer reasons "we use Bearer tokens, CSRF doesn't
apply" while the browser keeps sending the cookie.

Three requirements, all of them:

1. Cookie is `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. `Lax` alone blocks cross-site `POST`.
2. Every state-changing request validates `Origin` against `APP_URL`. No `Origin` and no `Bearer`
   on a non-`GET` method is a rejection.
3. `GET` never mutates — otherwise the first two are decorative.

Deliberately **no CSRF token scheme on top**. Three overlapping mechanisms nobody fully
understands is worse than two that are actually enforced.

## Why not the alternatives

- **Cookie only** — cheapest today, and it makes a native client a backend project later. That is
  precisely the cost ADR-0001 promised to avoid.
- **Bearer only** — pushes token storage into the browser, where XSS reaches it, and complicates
  Server Component rendering for no benefit while the only client is a browser.
- **Sessions in the database** — buys instant revocation, costs a query on every request. Worth
  revisiting if per-session logout is ever wanted; today rotating `AUTH_SECRET` logs everyone out
  and is the intended recovery action.
  *Revisited by [ADR-0012](0012-password-reset-via-single-use-token.md): E15 took the cheaper half
  — one `users.sessions_valid_from` column compared against `iat`, no session table — because a
  password reset that leaves the other person's cookie working has done nothing about the actual
  problem.*

## Consequences

- One `getSession()` reads either source; nothing downstream knows which was used.
- Rotating `AUTH_SECRET` invalidates every session and breaks nothing else.
- ~~There is no per-session revocation. A stolen token is valid until it expires~~ — accepted at
  this scale, and the reason expiry is short rather than a year.
  **Superseded by [ADR-0012](0012-password-reset-via-single-use-token.md) (E15):** a token is now
  valid only while its `iat >= users.sessions_valid_from`, so a reset or password change revokes
  every earlier session. Expiry still bounds a stolen token that predates no such event.
- Tests must cover both auth paths, and must cover the `Origin` rejection specifically. It is the
  control most likely to be quietly removed by someone debugging a local CORS problem.
