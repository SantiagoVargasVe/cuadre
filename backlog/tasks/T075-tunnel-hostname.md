---
id: T075
title: Add the app hostname to the Cloudflare Tunnel
epic: E8-deploy
status: done
depends_on: [T073]
size: S
---

## Context

Making the app publicly reachable without opening a router port. This is a **manual dashboard
action**, not code — the task exists so it isn't forgotten and so the gotchas are written down.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md) and
[architecture.md](../../docs/context/architecture.md) § *System*.

## Acceptance criteria

- [x] The public hostname on the existing tunnel routes to `http://cuadre-app:3000` (added in the
      Zero Trust dashboard; that tunnel is token-managed, so no server-side config file)
- [x] `cloudflared` (which lives in the Nextcloud compose on the host, not its own) joins the
      app's network via a `cuadre:` block under `networks:` with `external: true` / `name:
      cuadre_default`, added to that compose file — not `docker network connect`
- [x] Host `.env` has `APP_URL=https://cuadre.santiagovargas.co` (no trailing slash); it reaches
      the container via the compose `environment:` allowlist
- [x] Origin check verified against the live URL: `POST /api/auth/register` with
      `Origin: https://cuadre.santiagovargas.co` → `400 VALIDATION_ERROR` (past the gate);
      `Origin: https://evil.example` → `403 ORIGIN_NOT_ALLOWED`
- [x] **No router port-forward.** The tunnel is the only ingress — `docker-compose.prod.yml`
      publishes no ports, and nothing was forwarded on the router
- [x] Verified from outside the LAN: `GET /` → `307` → `GET /login` → `200` serving
      `Iniciar sesión — Cuadre`; `GET /api/auth/me` → `401`. Migrations ran at container boot.
      (Full register/group/expense walkthrough left to the operator so as not to seed prod data.)
- [x] Nothing host-specific in this repo — the hostname lives only in the host `.env` and the
      operator's notes

## Outcome (2026-08-29)

The host side of the deploy was never set up, which is why the dashboard hostname gave a `502`
(`cloudflared` had nothing to reach). Done on the box:

- Created `~/nas/cuadre/` — `docker-compose.yml` (copy of `infra/docker-compose.prod.yml`), `.env`
  (chmod 600, secrets generated on the host with `openssl`, never printed), `data/postgres/`.
- `docker compose up -d` → `cuadre_default` network, `cuadre-db` (healthy), `cuadre-app`
  (`✓ Ready`, migrations applied at boot).
- Added the `cuadre` external network to `~/nas/nextcloud/compose.yaml`'s `cloudflared` service
  (+ the `networks:` entry) and `docker compose up -d cloudflared` — recreated only that
  container; it's now on `cuadre_default` alongside `cuadre-app`.
- Installed `cuadre-deploy.{service,timer}` and `cuadre-fx.{service,timer}` +
  `/usr/local/bin/cuadre-fx-refresh` + `/etc/cuadre/fx-refresh.token` (chmod 600, `robin:robin` —
  the service runs as `robin`, not root). Both timers `enabled`.
- Verified: deploy service is a clean no-op pull; `cuadre-fx.service` →
  `fx refresh ok: {"inserted":2,...}` with USD→COP and USD→EUR rows in `fx_rates`.

GHCR package `ghcr.io/santiagovargasve/cuadre` is public (Santiago flipped it), so the host pulls
with no credentials.

## Out of scope

DNS for anything else. TLS — Cloudflare terminates it.

## Files likely touched

```
(none — dashboard action; note the outcome in the PR that closes this task)
```
