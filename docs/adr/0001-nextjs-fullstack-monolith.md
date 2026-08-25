# ADR-0001 — Next.js full-stack monolith

**Status:** Accepted · 2026-08-25

## Context

Cuadre is a web app with a backend, deployed to a home server that already runs a Next.js app
(wishlist) through a working chain: GitHub Actions CI → GHCR image → a systemd pull timer on the
host. That chain took real effort to get right and its failure modes are known.

The alternative on the table was a separate API service (Fastify or NestJS) plus a separate SPA —
the conventional choice when a native mobile client might follow, and expense splitting is a
phone-first activity.

## Decision

One Next.js 15 application. UI and API in the same container, separated by directory rather than
by network:

```
src/app/       routes + UI
src/server/    domain + data
src/lib/money/ pure math, imported by both
```

`src/app/` never imports Drizzle or talks to the database.

## Why not a separate backend

The mobile argument is the only serious one, and it is answered more cheaply. `/api` is already a
plain JSON API, and [ADR-0003](0003-jwt-cookie-and-bearer.md) makes auth accept a `Bearer` token
alongside the cookie. A native client later is a client to write, not a backend to extract.

Against that, splitting now costs two images, two CI pipelines, a CORS configuration, a second
deploy target on the same box, and token storage decisions made a year before anything needs
them. None of that makes the money math more correct, which is where the actual risk in this
project lives.

## Consequences

- One image, one deploy, reusing the existing pipeline verbatim
  ([ADR-0010](0010-deploy-via-ghcr-and-pull-timer.md)).
- The FE/BE boundary is a convention, so it needs enforcing: the import rule is stated in
  `CLAUDE.md`, in both scoped context files, and should be caught by lint.
- Migrations run at startup, which is safe at exactly one instance and races with replicas.
  Scaling out means moving them to a release step first.
- `src/lib/money/` is deliberately shared, so the client's live split preview uses the identical
  function the server resolves with. Two implementations that can disagree about who owes what is
  the failure this whole app exists to prevent.
- If a native client does arrive and the monolith chafes, extracting `src/server/` is mechanical —
  it's already framework-agnostic and takes plain arguments.
