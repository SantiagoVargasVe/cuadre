---
id: T070
title: infra/Dockerfile — multi-stage, Next standalone
epic: E8-deploy
status: done
depends_on: [T001]
size: S
---

## Context

The production image. Small, non-root, and reproducible.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md).

## Acceptance criteria

- [x] Multi-stage: `deps → builder → runner`, on Next's `output: "standalone"` (already set in
      `next.config.ts`, unchanged)
- [x] Runs as a **non-root user** (`nextjs:nodejs`, uid/gid 1001)
- [x] `linux/amd64` — the release workflow (T072) passes `--platform linux/amd64`; the Dockerfile
      itself is arch-neutral so it also builds on the arm64 dev machine for local verification
- [x] No `.env` and no secrets in any layer — `.dockerignore` drops `.env*` (keeps `.env.example`);
      the build needs no env because config resolution is lazy (T071)
- [x] A `.dockerignore` excluding `node_modules`, `.next`, `coverage`, `data`, `.git` (and `docs`,
      `backlog`, `.github`, tsbuildinfo)
- [x] Migrations run at startup via `src/instrumentation.ts`, production only — its comment already
      states it's safe at exactly one instance and races with replicas
- [x] `docker build -f infra/Dockerfile .` succeeds locally **with no `.env`**; the resulting
      image, run against a Postgres, serves `GET /login` → 200 and `GET /api/auth/me` → 401 on
      `:3000`, and runs the migrator at boot

## Out of scope

CI (T071), the release workflow (T072), compose (T073).

## Files likely touched

```
infra/Dockerfile
.dockerignore
next.config.ts
```
