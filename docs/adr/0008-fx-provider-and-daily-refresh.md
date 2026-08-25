# ADR-0008 — FX provider selection and the daily refresh

**Status:** Accepted · 2026-08-25

## Context

Converting a group needs COP/USD/EUR rates, refreshed at least once a day, from a source that
doesn't require a paid plan for a hobby project.

## The trap, stated first

**Frankfurter — and every other API backed by the ECB reference rates — cannot serve this app.**
It is the standard recommendation for free keyless FX, it will be the first result anyone finds,
and the ECB publishes 30 currencies of which **COP is not one**.

Verified 2026-08-25: `api.frankfurter.dev/v1/currencies` returns 30 entries, no `COP`.

An agent reaching for the familiar choice ships an app that cannot convert its own default
currency. That is why this ADR exists at all.

## Decision

**Primary: `open.er-api.com`** (exchangerate-api.com's free tier). No API key, 166 currencies
including COP, one request per base currency, updated daily around 00:00 UTC with
`time_last_update_utc` and `time_next_update_utc` in the payload.

Verified 2026-08-25: `USD→COP 3042.806266`, `USD→EUR 0.857211`.

**Cross-check: Colombia's official TRM** (`datos.gov.co`, SODA dataset `32sa-8pi3`). Keyless and
authoritative, but COP/USD only — a check, not a provider.

Verified the same day: TRM `3056.51` against the primary's `3042.81`. **Two legitimate sources,
same day, 0.45% apart.**

That disagreement is the design input, not a defect. There is no single true COP/USD rate; there
is a rate *from a source* on a *date*. So every stored rate carries `source` and `as_of`, every
pin records both, and the UI can say where a number came from. `FX_TRM_CROSSCHECK` logs a warning
past a threshold and never silently picks a winner.

## The refresh

```
systemd timer (host, daily) → POST /api/admin/fx/refresh
                              Authorization: Bearer $FX_REFRESH_TOKEN
```

Triggered from **outside** the container, mirroring the deploy-timer idiom already running on this
host. Not an in-process `setInterval`: that dies with the container and stops being a schedule
without telling anyone.

- **Idempotent**, upserting on `(base, quote, as_of, source)`. Run it ten times, get one row.
- **`FX_REFRESH_TOKEN` unset returns `404`**, not `401`. A misconfigured deploy fails closed
  instead of exposing an open endpoint.
- Scheduled ~02:00 UTC with a randomized delay — after the provider publishes, not at the top of
  the hour with everyone else.
- `npm run fx:refresh` runs the identical code path for debugging.

**Lazy fallback.** If a conversion needs a rate and none exists within the staleness window, fetch
on demand. A missed timer must never be why a member can't convert their group. If that fetch also
fails, return a typed `RATE_UNAVAILABLE` naming the missing pair and date — **never** fall back to
a stale rate silently.

## Why not the alternatives

- **ECB / Frankfurter** — no COP. Disqualified on the requirement, not on preference.
- **A paid API** — real money for a trip splitter used by a handful of friends, to fix a problem
  the free tier doesn't have.
- **Hardcoding a rate in config** — the sibling wishlist app had `FX_COP_PER_USD` and removed it;
  a hand-maintained rate is stale the day after it's set, and nobody remembers it exists.
- **In-process scheduler** — see above. The timer is also observable from the host
  (`journalctl`), which an interval inside a container is not.

## Consequences

- `fx_rates` is **append-only**. Never overwrite a past day's rate — a pinned group references it.
- Providers sit behind one interface in `src/server/fx/providers/`; swapping one must not touch
  conversion math or pinning. That interface also makes fixture-based testing straightforward,
  since no test may hit the network.
- Rates are read as **decimal strings** and shifted to scaled integers. A `parseFloat` anywhere in
  the FX path is a bug — and the kind that produces numbers that look right.
- A rate older than 7 days is refused for a **new** pin. Already-pinned groups are unaffected, by
  design ([ADR-0007](0007-reversible-display-currency.md)).
- Adding a currency means confirming provider coverage *and* handling its ISO exponent. Don't
  assume the primary covers something because it covers 166 things.
