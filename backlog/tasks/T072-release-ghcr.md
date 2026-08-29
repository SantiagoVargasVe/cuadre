---
id: T072
title: Release workflow — build and push to GHCR on CI success
epic: E8-deploy
status: done
depends_on: [T070, T071]
size: S
---

## Context

Turning a green `main` into a pullable image. The gating detail here has already caused a
confusing outage on the sibling app, so it is called out rather than discovered again.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md).

## Acceptance criteria

- [x] Triggered on **CI success** for `main` (`workflow_run` → `workflows: ["CI"]`,
      `branches: [main]`, `if: conclusion == 'success'`), not on push
- [x] Builds `linux/amd64` and pushes to GHCR as `latest` **and** `sha-<commit>`
      (`type=sha,format=long`) — the sha tag is what a rollback pins to
- [x] Built-in `GITHUB_TOKEN` via `docker/login-action`; `permissions: packages: write`. No PAT
- [x] Comment states **the GHCR package must be public** — what keeps "no GitHub credentials on the
      host" true; if it flips private the host needs a read-only PAT
- [x] Layer caching: `cache-from/to: type=gha, mode=max`
- [x] Header comment documents **don't merge two PRs within a minute** — CI's concurrency group
      cancels the older run, a cancelled run isn't a success, so that commit never gets an image
- [x] Header comment documents **never add a self-hosted runner** — public repo, PR authors could
      then run code inside the LAN
- **Manual, once, after this merges:** set the GHCR package `cuadre` visibility to Public
  (Packages → cuadre → Package settings → Change visibility). Until then the host can't pull
  without a PAT.

## Out of scope

The host side (T073).

## Files likely touched

```
.github/workflows/release.yml
```
