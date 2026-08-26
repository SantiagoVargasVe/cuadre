---
id: T052
title: FX refresh endpoint, lazy fallback, and the fx:refresh script
epic: E6-currency
status: done
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

- [x] `POST /api/admin/fx/refresh` with `Authorization: Bearer $FX_REFRESH_TOKEN`
- [x] **Idempotent**, upserting on `(base, quote, as_of, source)`. Ten runs, one row
- [x] **`FX_REFRESH_TOKEN` unset returns `404`, not `401`.** A misconfigured deploy fails closed
      rather than exposing an open endpoint
- [x] Token compared in **constant time**
- [x] Rate limited, keyed on the token
- [x] Returns `{ inserted, asOf, source }` so the timer's journal entry says something useful
- [x] **Lazy fallback**: when a conversion needs a rate and none exists within the staleness
      window, fetch on demand. A missed timer must never be why a member can't convert their group
- [x] If the lazy fetch also fails → typed `RATE_UNAVAILABLE` naming the missing
      `{ from, to, date }`. **Never a silent fall back to a stale rate**
- [x] Concurrent lazy fetches for the same pair don't stampede the provider — single-flight or an
      advisory lock
- [x] `npm run fx:refresh` runs the identical code path
- [x] Tests: repeat runs insert once; unset token yields `404`; wrong token yields `401`; the lazy
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

## Implementation notes

**"Identical code path" needed a `server-only`-free core.** `src/server/services/fx.ts` (the
route's dependency) carries `import "server-only"` transitively through `db/client.ts`, which
throws outside Next — the same reason `scripts/seed-invite.ts` and `drizzle.config.ts` import
`config.schema.ts` instead of `config.ts`. Split the actual fetch-and-upsert logic into
`src/server/fx/refresh-core.ts` with **no** `server-only` import anywhere in its chain, taking
`db` and `provider` as explicit parameters instead of reaching for app singletons. `services/fx.ts`
wraps it with the app's `db`/`getRateProvider()`/`config`; `scripts/fx-refresh.ts` builds its own
throwaway connection (`postgres()` + `drizzle()`, same pattern as `seed-invite.ts`) and calls the
same function directly. Added `export type Db = typeof db` to `db/client.ts` — a type-only import
is fully erased at compile time, so it can't trip the `server-only` runtime guard.

**The staleness window collapses to "does a row exist for today."** The provider can only ever
answer for the current day — there's no historical-rate lookup — so "within the staleness window"
and "as_of equals today's UTC date" are the same check for this task's scope. `ensureRate()`
looks for today's row; if it's there, no fetch happens at all.

**Single-flight, not an advisory lock** — a module-level `Promise` shared across concurrent
`ensureRate()` calls, sufficient because this app runs as one container (architecture.md). A
multi-instance deployment would need the Postgres advisory-lock alternative instead, since each
instance would hold its own copy of that module-level variable; flagging this explicitly as a
choice scoped to the current architecture, not a general solution.

**`RateProvider` gained a `readonly source` property** (extending T051's interface, in the same
PR that's its only consumer so far): `ensureRate()` needs to know exactly what `source` string a
successful refresh will stamp on a row, to look up "does today's row already exist" *before*
running a refresh. Assuming it matched `config.FX_PROVIDER`'s spelling by coincidence was a real
foot-gun waiting to happen the day those two strings ever drifted apart.

**A test bug caught a real gap, not just itself:** an early version of the "provider recovers
after a failure" test used `mockReturnValueOnce` for the failing provider, not realizing
`ensureRate()` calls `getRateProvider()` twice (once for `.source`, again inside the refresh
itself) — the second call fell through to the *real*, unmocked provider and made an actual network
request to open.er-api.com from inside a test. Fixed the test, but also confirms the "no network in
tests" discipline needs the mock to cover every call site, not just the first one a change touches.
