---
id: T074
title: FX refresh systemd timer
epic: E8-deploy
status: done
depends_on: [T052, T073]
size: S
---

## Context

The daily rate fetch. A **separate unit** from the deploy timer — they have nothing to do with each
other and folding them together makes both harder to reason about and to disable independently.

Read [ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) § *The refresh*.

## Acceptance criteria

- [x] `cuadre-fx.service` (oneshot) + `cuadre-fx.timer`, driving `cuadre-fx-refresh` which
      `POST`s `/api/admin/fx/refresh` with the bearer token
- [x] `OnCalendar=*-*-* 02:00:00 UTC` + `RandomizedDelaySec=20min` — after the provider publishes,
      off the top of the hour
- [x] `Persistent=true`
- [x] Token read from `/etc/cuadre/fx-refresh.token` (`chmod 600`) and **piped to the app over
      stdin** — never an argv element, so never in `ps` or the journal. (curl/wget can't take a
      header from a file without putting it on the command line; a stdin pipe to `node` can.)
- [x] Calls `http://localhost:3000` **inside the app container** via `docker compose exec`, not
      the public hostname — independent of the tunnel
- [x] Failures exit non-zero with the reason on stderr → `journalctl -u cuadre-fx.service`; a
      success logs `fx refresh ok: {"inserted":N,"asOf":"…","source":"…"}`
- [x] `infra/deploy/README.md` § *FX refresh timer* states a missed run is **not** an outage —
      T052's lazy fallback fetches on demand
- [x] Verified end to end against the prod compose stack locally: first `cuadre-fx-refresh` run
      inserted rows, a second run the same day returned `"inserted":0`

## Files touched

Adds `infra/deploy/cuadre-fx-refresh` (a small POSIX-sh helper) alongside the units named below —
it keeps the token off every command line and the unit file readable.

## Out of scope

The endpoint itself (T052).

## Files likely touched

```
infra/deploy/{cuadre-fx.service,cuadre-fx.timer,README.md}
```
