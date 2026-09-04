---
id: T131
title: Strip the operator's machine from the repo — paths, account, hostnames, neighbours
epic: E8-deploy
status: done
depends_on: []
size: S
---

## Context

Non-negotiable 11: **this repo is public.** No host-specific details — no private IPs, service
inventories, domains, or server paths. An audit on 2026-09-04 found eleven violations across
`infra/` and `backlog/`, in three classes of decreasing severity:

- **Service inventory** — the strongest disclosure by a distance. `T076` named the five stacks
  sharing one `cloudflared` (`nextcloud, immich, wishlist, cuadre, monitoring`) and `T075` recorded
  which neighbour's compose file owns that container. That is a map of one box's attack surface,
  and none of it is needed to explain the service-key rule it was written to justify.
- **Operator account and filesystem layout** — `User=robin`, `/home/robin/nas/cuadre`,
  `~/nas/nextcloud/compose.yaml`, `robin:robin`.
- **Public hostnames** — the app's own origin and a neighbour's. Least sensitive, since the app's
  hostname is resolvable by anyone who uses it, but it is still somebody's machine in a public repo.

The irony worth recording: `T075`'s own acceptance criteria included *"Nothing host-specific in
this repo — the hostname lives only in the host `.env` and the operator's notes"*, and its Outcome
section then documented the hostname, the account, the neighbour, and the paths. A criterion that
is checked at the top of a file and violated at the bottom is the normal way this happens.

**The fix is to generalise, never to delete the reasoning.** The 502 incident is why the
service-key rule exists and the write-up has to stay convincing without naming anyone's box.

Read [architecture.md](../../docs/context/architecture.md) and the repo's non-negotiable 11.

## Acceptance criteria

- [x] `infra/deploy/cuadre-fx.service` — `User=` is a placeholder with the same "edit before
      installing" comment `cuadre-deploy.service` got in T130
- [x] `infra/deploy/cuadre-fx-refresh` — `COMPOSE_DIR` defaults to a placeholder, with the existing
      `CUADRE_COMPOSE_DIR` override unchanged in behaviour
- [x] `infra/deploy/README.md` — the host-layout example is a generic path
- [x] `infra/docker-compose.prod.yml` — the 502 story keeps its force without naming the
      neighbouring hostname. This file is now fetched onto the host each tick (T130), so it is the
      most-read file in the repo
- [x] `backlog/tasks/T076` — the mechanism (shared `cloudflared`, DNS resolving a name across every
      attached network, three stacks declaring `app`) is intact; the stack inventory and both
      hostnames are gone
- [x] `backlog/tasks/T075` — hostname, deploy directory, neighbour's compose path, and the account
      name generalised. The verification record stays legible as evidence
- [x] `backlog/README.md` — the T076 index line no longer names the neighbour
- [x] Re-audited with one grep over `robin`, `/home/`, `~/nas`, the domain, `homeserver`, private
      IP ranges, and every neighbouring service name. Only false positives remain (`probing`
      contains `robin`)
- [x] `ghcr.io/santiagovargasve/cuadre` and `github.com/SantiagoVargasVe/...` are deliberately
      **kept**. They are the public package and repository this software is published from, not
      the topology of anybody's machine
- [x] **Git history is not rewritten.** The values remain in earlier commits; rewriting would break
      every clone, pinned SHA, and merged PR link for values of this sensitivity. The point of this
      task is to stop carrying them forward, not to claim they were never published

## Out of scope

Rewriting git history. The operator's own notes, which are the correct home for all of this. Any
behaviour change: the installed copies under `/etc/systemd/system/` and `/usr/local/bin/` are
copies, so editing the repo cannot disturb a running host — the placeholders matter at the next
re-install, which is what the README already covers.

## Files likely touched

```
infra/deploy/cuadre-fx.service
infra/deploy/cuadre-fx-refresh
infra/deploy/README.md
infra/docker-compose.prod.yml
backlog/tasks/T075-tunnel-hostname.md
backlog/tasks/T076-unique-compose-service-name.md
backlog/README.md
```
