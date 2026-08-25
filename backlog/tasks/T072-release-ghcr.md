---
id: T072
title: Release workflow — build and push to GHCR on CI success
epic: E8-deploy
status: todo
depends_on: [T070, T071]
size: S
---

## Context

Turning a green `main` into a pullable image. The gating detail here has already caused a
confusing outage on the sibling app, so it is called out rather than discovered again.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md).

## Acceptance criteria

- [ ] Triggered on **CI success** for `main`, not on push
- [ ] Builds `linux/amd64` and pushes to GHCR as `latest` **and** `sha-<commit>` — the sha tag is
      what a rollback pins to
- [ ] Uses the built-in `GITHUB_TOKEN`. No PAT
- [ ] **The GHCR package must be public.** That is what keeps "no GitHub credentials on the host"
      true. If it ever flips private, the host needs a read-only PAT
- [ ] Layer caching so a release doesn't take longer than the CI run that gated it
- [ ] Document in the workflow: **don't merge two PRs within a minute of each other.** The second
      merge cancels the first's in-flight CI run, and since release is gated on *CI success*, that
      commit never gets an image
- [ ] **Never add a self-hosted runner.** This repo is public; any PR author could then run code
      inside the LAN

## Out of scope

The host side (T073).

## Files likely touched

```
.github/workflows/release.yml
```
