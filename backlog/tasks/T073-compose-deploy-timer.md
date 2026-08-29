---
id: T073
title: Production compose and the deploy pull timer
epic: E8-deploy
status: done
depends_on: [T072]
size: M
---

## Context

The host side of the deploy: pull, don't push. No inbound port, no webhook receiver, and no
credentials on the server.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md) and
[architecture.md](../../docs/context/architecture.md) § *Deployment*.

## Acceptance criteria

- [x] `infra/docker-compose.prod.yml`: `app` pinned to `ghcr.io/santiagovargasve/cuadre:latest`,
      plus `postgres:17-alpine`
- [x] `restart: unless-stopped` on both
- [x] `./data/postgres` bind-mounted. **No `ports:` on either service** — the tunnel is the only
      way in (`docker compose config` confirms no published port)
- [x] `environment:` is an explicit allowlist — every schema var named, `DATABASE_URL` composed
      with the `postgres://` scheme the schema requires; a comment says a key in `.env` not named
      here never reaches the container
- [x] `infra/deploy/cuadre-deploy.{service,timer}` — oneshot `docker compose pull --quiet` then
      `up -d`, `OnUnitActiveSec=5min`, `Persistent=true`, `RandomizedDelaySec=30s`
- [x] `infra/deploy/README.md` documents: **rollback — stop the timer first**, then pin
      `sha-<commit>`; `.env`-value-only changes need `up -d --force-recreate`;
      `journalctl -u cuadre-deploy.service -n 50` shows the last deploy
- [x] **Backups** — its own prominent section: `data/postgres/` is the only non-reconstructable
      copy; this repo implements none; the operator must, and must test a restore
- [x] No secrets anywhere in `infra/` — README's closing section states it; `.env` is host-only,
      `chmod 600`

## Out of scope

The FX timer (T074). The tunnel hostname (T075).

## Files likely touched

```
infra/docker-compose.prod.yml
infra/deploy/{cuadre-deploy.service,cuadre-deploy.timer,README.md}
```
