---
id: T074
title: FX refresh systemd timer
epic: E8-deploy
status: todo
depends_on: [T052, T073]
size: S
---

## Context

The daily rate fetch. A **separate unit** from the deploy timer — they have nothing to do with each
other and folding them together makes both harder to reason about and to disable independently.

Read [ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) § *The refresh*.

## Acceptance criteria

- [ ] A systemd service + timer calling `POST /api/admin/fx/refresh` with the bearer token
- [ ] **Daily at ~02:00 UTC with a randomized delay** — after the provider publishes
      (~00:00–00:30 UTC), and not at the top of the hour with everything else
- [ ] `Persistent=true`, so a run missed while the box was off fires on the next boot
- [ ] The token is read from a file with restrictive permissions, **never** passed as a command-line
      argument where it lands in the process list
- [ ] It calls the app over the container network or localhost, not through the public hostname —
      an internal job shouldn't depend on the tunnel being up
- [ ] Failures are visible in `journalctl`, and the endpoint's `{ inserted, asOf, source }` response
      is logged so a journal entry says something useful
- [ ] `infra/deploy/README.md` documents that **a missed run is not an outage** — the lazy fallback
      in T052 fetches on demand
- [ ] Verified end to end: run it manually, confirm rows land, confirm a second run is a no-op

## Out of scope

The endpoint itself (T052).

## Files likely touched

```
infra/deploy/{cuadre-fx.service,cuadre-fx.timer,README.md}
```
