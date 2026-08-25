---
id: T073
title: Production compose and the deploy pull timer
epic: E8-deploy
status: todo
depends_on: [T072]
size: M
---

## Context

The host side of the deploy: pull, don't push. No inbound port, no webhook receiver, and no
credentials on the server.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md) and
[architecture.md](../../docs/context/architecture.md) § *Deployment*.

## Acceptance criteria

- [ ] `infra/docker-compose.prod.yml`: the app pinned to the GHCR image, plus `postgres:17-alpine`
- [ ] `restart: unless-stopped` on both, so the stack returns after a reboot
- [ ] `data/postgres/` bind-mounted. **No port published for the app or the database** — the tunnel
      is the only way in
- [ ] Every needed variable is named in the compose `environment:` block. **It is an allowlist** —
      a key existing in `.env` does not mean it reaches the container
- [ ] `infra/deploy/` holds the systemd service + timer (5 min): `docker compose pull && up -d`
- [ ] `infra/deploy/README.md` documenting, at minimum:
      - **Rollback: stop the timer first**, then pin a `sha-<commit>` tag — otherwise the next tick
        pulls `latest` straight back over the pin
      - `docker compose up -d` will **not** recreate a container for `.env`-content-only changes;
        that needs `--force-recreate`
      - `journalctl -u <unit>` shows what the last deploy did
- [ ] **A backup note, prominently.** `data/postgres/` is the only copy of data that cannot be
      reconstructed — a trip's ledger has no external source, unlike a wishlist item and its URL.
      This repo doesn't implement backups; the operator must
- [ ] No secrets committed anywhere in `infra/`

## Out of scope

The FX timer (T074). The tunnel hostname (T075).

## Files likely touched

```
infra/docker-compose.prod.yml
infra/deploy/{cuadre-deploy.service,cuadre-deploy.timer,README.md}
```
