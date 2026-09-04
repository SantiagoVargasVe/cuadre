---
id: T076
title: Give the prod compose service a globally unique key
epic: E8-deploy
status: done
depends_on: [T073, T074]
size: S
---

## Context

`infra/docker-compose.prod.yml` declared the app as `services: app:`. Compose gives every service
its **service key** as a network alias in addition to `container_name`, and that alias cannot be
suppressed — it is derived from the key.

A shared `cloudflared` container may be attached to several stacks' networks at once, and Docker's
embedded DNS resolves a name across **all** networks a container is attached to. Three stacks each
declaring `app` meant three containers answered to that one name. A neighbouring stack's tunnel
ingress pointed at the bare `app:80`, so cloudflared resolved it to whichever DNS returned — and on
2026-08-30 it landed on `cuadre-app`, which listens on 3000, not 80. That hostname served a hard 502
until the service keys were renamed.

Cuadre's own routing was never broken: the tunnel points at `cuadre-app:3000`, the container name,
which is unique. But this file supplied the alias that actually captured the traffic. See
[ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md) for the deploy chain.

The rename has a second consequence this repo has to carry: `infra/deploy/cuadre-fx-refresh` calls
`docker compose exec -T app node`, addressing the service by **key**, not container name. Renaming
the key without updating the helper breaks the FX refresh timer at its next daily run.

## Acceptance criteria

- [x] The prod compose service key is `cuadre-app`, matching `container_name`
- [x] `infra/deploy/cuadre-fx-refresh` execs `cuadre-app`, not `app`
- [x] A comment in the compose file states why the key must be globally unique **and** that
      `docker compose exec` callers are coupled to it
- [x] `docker compose -f infra/docker-compose.prod.yml config` still validates
- [x] The FX refresh path is verified against the renamed service, not just assumed

## Out of scope

- **The `db` service key**, which also collides with wishlist's `db`. It is harmless: nothing outside
  each stack's own network ever resolves it, and renaming would require changing `DATABASE_URL` in
  the same commit for no benefit. Revisit only if `db` is ever routed through the tunnel.
- Tunnel ingress rules — Cloudflare dashboard state, not repo state.
- The identical compose fix in the wishlist repo, which ships as its own PR.

## Files likely touched

```
infra/docker-compose.prod.yml
infra/deploy/cuadre-fx-refresh
backlog/tasks/T076-unique-compose-service-name.md
backlog/README.md
```
