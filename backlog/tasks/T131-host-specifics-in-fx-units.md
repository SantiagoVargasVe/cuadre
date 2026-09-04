---
id: T131
title: Remove the operator's path and account name from the FX units
epic: E8-deploy
status: todo
depends_on: []
size: S
---

## Context

Non-negotiable 11: **this repo is public.** No host-specific details — no private IPs, service
inventories, domains, or server paths. Three committed values break it, all in `infra/deploy/`:

```
infra/deploy/cuadre-fx.service:13     User=robin
infra/deploy/cuadre-fx-refresh:15     COMPOSE_DIR="${CUADRE_COMPOSE_DIR:-/home/robin/nas/cuadre}"
```

T130 fixed the same leak in `cuadre-deploy.service` because it was rewriting that file anyway, and
deliberately left these rather than widening its diff. A real home path and account name describe
somebody's machine rather than the software, and they are the kind of detail that is trivially
scraped from a public repository.

Read [architecture.md](../../docs/context/architecture.md) and
[infra/deploy/README.md](../../infra/deploy/README.md) § *FX refresh timer*. The README already
documents `CUADRE_COMPOSE_DIR` / `CUADRE_FX_TOKEN_FILE` as the override mechanism, so the shape of
the answer exists — only the committed defaults are wrong.

## Acceptance criteria

- [ ] `cuadre-fx.service` uses a placeholder `User=`, with the same "edit before installing"
      comment `cuadre-deploy.service` carries after T130
- [ ] `cuadre-fx-refresh`'s `COMPOSE_DIR` default is a placeholder (`/srv/cuadre`), keeping the
      existing `CUADRE_COMPOSE_DIR` override intact and unchanged in behaviour
- [ ] `infra/deploy/README.md` states plainly that the units ship with placeholders and must be
      edited for the host before installing — once, next to the existing install steps, not
      repeated per unit
- [ ] `git log -S robin -- infra/` is checked and the PR says whether the value also sits in
      history. **Do not rewrite history to remove it** — that breaks every clone and pinned SHA for
      a value of this sensitivity. Note it and move on
- [ ] No behaviour change on the running host: the installed copies at `/etc/systemd/system/` and
      `/usr/local/bin/` are copies, so editing the repo cannot disturb them. The next re-install is
      when the placeholders matter, which is what the README change is for

## Out of scope

The deploy unit (T130 already did it). Rewriting git history. Any change to what the FX timer
does, its schedule, or the token-over-stdin mechanism. The `cloud.santiagovargas.co` reference in
`infra/docker-compose.prod.yml`'s header — that is a different judgement call about an incident
narrative naming another service, and belongs in its own discussion rather than being swept in
here.

## Files likely touched

```
infra/deploy/cuadre-fx.service
infra/deploy/cuadre-fx-refresh
infra/deploy/README.md
```
