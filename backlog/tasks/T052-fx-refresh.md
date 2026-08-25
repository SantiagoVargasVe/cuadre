---
id: T052
title: FX refresh endpoint, lazy fallback, and the fx:refresh script
epic: E6-currency
status: todo
depends_on: [T051]
size: M
---

## Context

Getting rates into the database once a day, and making sure a missed run never becomes a member's
problem. Triggered externally rather than by an in-process scheduler, because an interval inside a
container dies with the container and stops being a schedule without telling anyone.

Read [ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) § *The refresh* and
[api-contract.md](../../docs/context/api-contract.md) § *Admin*.

## Acceptance criteria

- [ ] `POST /api/admin/fx/refresh` with `Authorization: Bearer $FX_REFRESH_TOKEN`
- [ ] **Idempotent**, upserting on `(base, quote, as_of, source)`. Ten runs, one row
- [ ] **`FX_REFRESH_TOKEN` unset returns `404`, not `401`.** A misconfigured deploy fails closed
      rather than exposing an open endpoint
- [ ] Token compared in **constant time**
- [ ] Rate limited, keyed on the token
- [ ] Returns `{ inserted, asOf, source }` so the timer's journal entry says something useful
- [ ] **Lazy fallback**: when a conversion needs a rate and none exists within the staleness
      window, fetch on demand. A missed timer must never be why a member can't convert their group
- [ ] If the lazy fetch also fails → typed `RATE_UNAVAILABLE` naming the missing
      `{ from, to, date }`. **Never a silent fall back to a stale rate**
- [ ] Concurrent lazy fetches for the same pair don't stampede the provider — single-flight or an
      advisory lock
- [ ] `npm run fx:refresh` runs the identical code path
- [ ] Tests: repeat runs insert once; unset token yields `404`; wrong token yields `401`; the lazy
      path fires exactly once for concurrent callers; a total provider failure surfaces
      `RATE_UNAVAILABLE` and never a stale rate

## Out of scope

The systemd timer unit (T074). Pinning (T053).

## Files likely touched

```
src/app/api/admin/fx/refresh/route.ts
src/server/fx/refresh.ts
src/server/services/fx.ts
scripts/fx-refresh.ts
```
