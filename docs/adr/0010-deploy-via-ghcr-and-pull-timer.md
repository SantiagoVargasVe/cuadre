# ADR-0010 — Deploy via GHCR and a host pull timer

**Status:** Accepted · 2026-08-25

## Context

The app runs on a self-hosted box that already hosts other services. It needs to deploy on merge
to `main` without a human on the server, and without giving a public repository any inbound reach
into a home network.

An identical chain already runs on this host for the sibling wishlist app. Its failure modes are
known, which is worth more than any theoretical improvement.

## Decision

```
merge to main → CI (lint, typecheck, test, build)
              → on CI success: build linux/amd64 → push to GHCR
              → host timer (every 5 min): docker compose pull && up -d
```

The host pulls. Nothing pushes into the network, and the deploy needs no inbound port, no webhook
receiver, and no credentials on the server as long as the GHCR package stays public.

## Why pull, not push

A push-based deploy needs either an inbound path into the home network or a self-hosted runner.

**A self-hosted runner on a public repository is the thing to never do here** — any pull request
author could run arbitrary code inside the LAN. If this repo is public (it is intended to be), that
is disqualifying on its own.

## Consequences and known traps

Inherited from operating this chain next door. They are not hypothetical:

- **Don't merge two PRs within a minute of each other.** The second merge cancels the first's
  in-flight CI run, and since the release job is gated on *CI success*, that commit never gets an
  image. Merge one, let CI go green, merge the next.
- **Rollback: stop the timer first**, then pin a `sha-<commit>` tag in the compose file. Otherwise
  the next tick pulls `latest` straight back over the pin.
- **Keeping the GHCR package public** is what keeps "no GitHub credentials on the host" true. If it
  ever flips private, the host needs a read-only PAT.
- **Compose `environment:` is an allowlist.** A key existing in `.env` does not mean it reaches the
  container. The second half of this bullet used to claim that `docker compose up -d` will not
  recreate a container for `.env`-content-only changes; **that was measured on 2026-09-04 and is
  false** (on Compose v2.39.4 — not re-verified on the host's v5.x). Compose hashes the resolved
  configuration and interpolation precedes the hash, so an env-value edit does recreate.
  `--force-recreate` remains the version-independent way to be certain.
- **The tick syncs the compose file from the repository** (T130, added 2026-09-04). Until then it
  kept the image current and nothing else, so `infra/docker-compose.prod.yml` was a template the
  running deployment never saw — which is how T120's five `MAIL_*` keys reached the host's `.env`,
  the image, and the code, but never the container. This widens what a commit to `main` can do,
  from "replace the application" to "reconfigure the deployment", so the fetch is tolerated on
  failure and the download is swapped in only once it is non-empty and `docker compose config -q`
  parses it. **`.env` is not synced** — it holds the secrets and every per-deployment difference.
  The cost is that the rollback procedure's "stop the timer first" is now mandatory: a pinned
  `sha-` tag lives in the file the tick overwrites.
- **Migrations run at app startup**, production only. Safe at exactly one instance; would race with
  replicas.
- Exposure is via a public hostname on the existing Cloudflare Tunnel, so no router port is opened.
  Adding the hostname is a dashboard action.

## What is different from the sibling app

- **`data/postgres/` is the only copy of data that cannot be reconstructed.** A wishlist item can
  be re-added from its URL; a trip's ledger cannot be re-derived from anything. Backups are an
  operator obligation, and this repo should not pretend otherwise
  ([architecture.md](../context/architecture.md)).
- There is **no image bind-mount** to get file permissions wrong — Cuadre stores no user files in
  v1. Receipt photos (E10) would introduce that; whoever adds them should read how that went next
  door before designing the mount.
- A second systemd timer is needed for the daily FX refresh
  ([ADR-0008](0008-fx-provider-and-daily-refresh.md)). It is unrelated to the deploy timer and
  should be a separate unit, not folded into it.
