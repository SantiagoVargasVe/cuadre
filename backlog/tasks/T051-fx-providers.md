---
id: T051
title: FX provider interface, open.er-api.com, and the TRM cross-check
epic: E6-currency
status: todo
depends_on: [T050]
size: M
---

## Context

Fetching rates that actually cover COP.

> **Read [ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) before writing any
> code.** The obvious free choice — Frankfurter, or anything ECB-backed — publishes 30 currencies
> and **COP is not among them**. It is the first result anyone finds and it cannot serve this app.

## Acceptance criteria

- [ ] `RateProvider` interface in `src/server/fx/providers/` — one method, returning rates plus
      `asOf` and `source`
- [ ] `open.er-api.com` provider: keyless, base from `FX_BASE_CURRENCY`, parses
      `time_last_update_utc` into `as_of` rather than assuming today
- [ ] Response validated with Zod. A provider returning `result: "error"`, or missing a currency in
      `SUPPORTED_CURRENCIES`, is a typed failure — **never a partial write**
- [ ] TRM cross-check provider (`datos.gov.co`, dataset `32sa-8pi3`), COP/USD only. Note in code
      that `vigenciahasta` spans weekends and holidays, so one row can cover three days
- [ ] When `FX_TRM_CROSSCHECK=true`, compare the COP/USD leg and **log a warning past a
      threshold**. It never silently picks a winner — the two sources genuinely disagreed by 0.45%
      on the day this was designed, and neither is wrong
- [ ] Timeouts and a bounded retry. One failed fetch must not hang a request that fell through to
      the lazy path
- [ ] **No network in tests.** Fixture-based, using recorded payloads from both providers —
      including an error payload and one missing a currency
- [ ] Tests: a valid payload maps to the expected rates and `asOf`; an error payload throws
      typed; a missing currency throws rather than writing a partial set; the cross-check warns on
      divergence and does not throw

## Out of scope

The refresh endpoint and timer (T052). Pinning (T053).

## Files likely touched

```
src/server/fx/providers/{index,open-er-api,trm}.ts
src/server/fx/providers/__fixtures__/
src/server/fx/providers/*.test.ts
```
