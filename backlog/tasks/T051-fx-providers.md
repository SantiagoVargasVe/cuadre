---
id: T051
title: FX provider interface, open.er-api.com, and the TRM cross-check
epic: E6-currency
status: done
depends_on: [T050]
size: M
---

## Context

Fetching rates that actually cover COP.

> **Read [ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) before writing any
> code.** The obvious free choice — Frankfurter, or anything ECB-backed — publishes 30 currencies
> and **COP is not among them**. It is the first result anyone finds and it cannot serve this app.

## Acceptance criteria

- [x] `RateProvider` interface in `src/server/fx/providers/` — one method, returning rates plus
      `asOf` and `source`
- [x] `open.er-api.com` provider: keyless, base from `FX_BASE_CURRENCY`, parses
      `time_last_update_utc` into `as_of` rather than assuming today
- [x] Response validated with Zod. A provider returning `result: "error"`, or missing a currency in
      `SUPPORTED_CURRENCIES`, is a typed failure — **never a partial write**
- [x] TRM cross-check provider (`datos.gov.co`, dataset `32sa-8pi3`), COP/USD only. Note in code
      that `vigenciahasta` spans weekends and holidays, so one row can cover three days
- [x] When `FX_TRM_CROSSCHECK=true`, compare the COP/USD leg and **log a warning past a
      threshold**. It never silently picks a winner — the two sources genuinely disagreed by 0.45%
      on the day this was designed, and neither is wrong
- [x] Timeouts and a bounded retry. One failed fetch must not hang a request that fell through to
      the lazy path
- [x] **No network in tests.** Fixture-based, using recorded payloads from both providers —
      including an error payload and one missing a currency
- [x] Tests: a valid payload maps to the expected rates and `asOf`; an error payload throws
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

## Implementation notes

**open.er-api.com transmits rates as bare JSON numbers, not strings** — unlike our own
`fx_rates.rate` column, this app doesn't control that wire format, and `response.json()` would
hand back a value that's already been through `JSON.parse`'s double conversion (the exact
`parseFloat`-shaped mistake currency.md warns against). Fixed by reading the **raw response
text** and regex-matching `"CODE":<digits>` directly, extracting the exact characters the server
sent with zero float conversion anywhere in the path — safe for well-formed JSON specifically
because object keys are unique and quoted, so a key can't appear as a substring of another key.
Verified with a dedicated test using a rate with more significant digits than a double reliably
round-trips, proving the extracted string matches the wire text exactly. Zod still validates the
overall response *shape* (including that `rates` values are numbers) — it's the specific rate
*values* this app actually uses that skip the parsed-number path entirely.

The TRM (`datos.gov.co`) dataset doesn't have this problem — Socrata returns its numeric `valor`
field as a JSON string already, which is the whole reason SODA APIs commonly do that.

**The divergence threshold is 1% (100 basis points),** chosen because it's comfortably above the
0.45% gap ADR-0008 measured between the two sources on an ordinary day — routine noise between
two legitimate-but-different sources shouldn't page anyone — while still catching a real anomaly
(a stale fetch, a provider outage returning garbage, a currency mix-up). This is a judgment call
with no single obviously-correct value; flagging it for review.

TRM row selection fetches a small page of recent rows (ordered newest-first) and filters
client-side for the row whose `[vigenciadesde, vigenciahasta]` window contains the requested
date, rather than building a SoQL date-range query string by hand — simpler to get right and to
test with a small fixture.

Verified the timeout/retry behavior with `vi.useFakeTimers()` and a fetch mock that only ever
resolves by reacting to the abort signal (exactly like a real hung connection), rather than just
asserting the retry count on an immediately-rejecting mock — proves the `AbortController` timeout
actually fires, not just that the retry loop exists.
