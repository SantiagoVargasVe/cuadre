---
id: T130
title: Sync the compose file from the repo on each deploy tick
epic: E8-deploy
status: done
depends_on: []
size: S
---

## Context

[ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md)'s timer keeps the **image**
current and nothing else. `docker-compose.yml` is copied onto the host by hand at first-time setup
and never updated again, so every subsequent change to `infra/docker-compose.prod.yml` is a change
to a template the running deployment never sees — with nothing anywhere reporting the drift.

**This is not hypothetical; it cost a working feature.** T120 added five `MAIL_*` keys to the
compose `environment:` allowlist. The values were on the host in `.env`, the code shipped, the
image was current — and the container received none of them, because the host's compose file was
still the pre-T120 copy. `isMailConfigured()` was false in production, so registration and resend
silently sent nothing and minted no token. Verified on 2026-09-04: `MAIL_*` present in the host
`.env`, absent from the host's `docker-compose.yml`, absent from `docker exec cuadre-app printenv`,
and `auth_tokens` empty.

The sibling wishlist repo hit the identical failure with the identical five variables and fixed it
in its T111. This is that fix, ported — read the shape there before rewriting it from scratch.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md),
[infra/deploy/README.md](../../infra/deploy/README.md), and the header comment in
[infra/docker-compose.prod.yml](../../infra/docker-compose.prod.yml) — the service-key rule there
is exactly the kind of change that has to be able to reach a deployment.

## Acceptance criteria

- [x] `cuadre-deploy.service` fetches `infra/docker-compose.prod.yml` from the repository over
      HTTPS at the start of each tick, before the image pull. The URL is a single `Environment=`
      line so a fork changes one line
- [x] The download lands under a **temporary name** and is swapped in only when it is non-empty
      **and** `docker compose -f <tmp> config -q` parses it. A truncated fetch or a bad commit must
      not replace a working deployment with one that cannot start — the next tick would then have
      nothing good to fall back to
- [x] A fetch failure is **tolerated** (systemd's leading `-`) and does not stop that tick's image
      deploy. The repository host being down while the registry is up is ordinary, and the image is
      the half that carries security fixes
- [x] **`.env` is not synced, and never will be.** It holds secrets, and it is where every
      per-deployment difference belongs. Say so in the unit and in the README
- [x] The unit's comment claiming `up -d` "only recreates the container if the image actually
      moved" is corrected. It also recreates when the resolved configuration changes, and that half
      is the mechanism this whole change depends on
- [x] `WorkingDirectory` and `User` become placeholders. The committed unit currently carries the
      operator's real home path and account name, and **this repo is public** (non-negotiable 11) —
      a real path and account name describe somebody's machine, not the software
- [x] `infra/deploy/README.md`: first-time setup notes that the compose copy is now a bootstrap
      rather than a permanent hand-maintained file; the "Operating it" paragraph matches the
      corrected recreate semantics; and the **rollback procedure states that stopping the timer is
      now mandatory, not advisory** — pinning a `sha-` tag edits the very file the tick overwrites,
      so an un-stopped timer erases the pin rather than merely outrunning it. A durable rollback
      belongs in the repo, where the sync carries it
- [x] `ADR-0010` gains a consequence recording that the tick now reconfigures the deployment, not
      only the application, and what guards that
- [x] Verified by exercising the swap logic against a scratch compose project, all four paths: good
      fetch swaps in; truncated fetch discarded; empty/failed fetch discarded; no fetch at all
      exits clean. In each failing case the working file must be intact. Record the results in the
      PR — a systemd unit cannot be covered by `npm run test:ci`, so this is the only verification
      that exists
- [x] The raw URL is fetched once and confirmed to serve the current file, including the `MAIL_*`
      lines

## Out of scope

Syncing `.env`, the timer's interval, the FX units, and any change to what CI or `release.yml`
build. Moving migrations out of app startup (ADR-0010 lists it; unrelated). The remaining
host-specific values in `cuadre-fx.service` and `cuadre-fx-refresh` — same class of problem, but a
different file and a separate task (T131).

## Files likely touched

```
infra/deploy/cuadre-deploy.service
infra/deploy/README.md
docs/adr/0010-deploy-via-ghcr-and-pull-timer.md
```
