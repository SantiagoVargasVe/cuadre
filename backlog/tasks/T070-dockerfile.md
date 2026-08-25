---
id: T070
title: infra/Dockerfile — multi-stage, Next standalone
epic: E8-deploy
status: todo
depends_on: [T001]
size: S
---

## Context

The production image. Small, non-root, and reproducible.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md).

## Acceptance criteria

- [ ] Multi-stage: deps → build → runtime, using Next's `output: "standalone"`
- [ ] Runs as a **non-root user**
- [ ] `linux/amd64` — that's what the host is
- [ ] No `.env` and no secrets baked into any layer
- [ ] A `.dockerignore` excluding `node_modules`, `.next`, `coverage`, `data`, `.git`
- [ ] Migrations run at startup via `src/instrumentation.ts`, **production only**. The comment
      there must say it's safe at exactly one instance and races with replicas
- [ ] `docker build` succeeds locally and the container serves on `:3000`

## Out of scope

CI (T071), the release workflow (T072), compose (T073).

## Files likely touched

```
infra/Dockerfile
.dockerignore
next.config.ts
```
