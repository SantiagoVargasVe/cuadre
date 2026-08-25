# Currency and FX

Covers rate sourcing, the daily refresh, and the reversible display-currency conversion.
The arithmetic that *uses* these rates lives in [splitting.md](splitting.md) §6.

## Supported currencies

`COP` (default) · `USD` · `EUR`. Declared in `SUPPORTED_CURRENCIES`, validated at boot.

Adding a currency is not a config change alone. It needs: provider coverage confirmed, the
ISO-4217 minor-unit exponent handled, and a display rule decided. The current three all have
exponent 2, which makes a lot of arithmetic incidentally simple — **the first exponent-0 currency
(JPY, CLP, KRW) will break any code that assumed the exponents match.** Write the exponent
conversion properly the first time; see [splitting.md](splitting.md) §1.

## Choosing a provider — read this before swapping it

> **The obvious answer is wrong.** Frankfurter, and every other API backed by the ECB reference
> rates, is the standard recommendation for free keyless FX — and it **cannot serve this app**.
> The ECB publishes 30 currencies and **COP is not one of them** (verified 2026-08-25:
> `api.frankfurter.dev/v1/currencies` returns 30 entries, no `COP`). An agent reaching for the
> familiar choice will get an app that silently cannot convert the default currency.

**Primary: `open.er-api.com`** (exchangerate-api.com's free tier)

- No API key. 166 currencies including COP. One request returns every rate against a base.
- Updates once daily, around 00:00 UTC. The payload carries `time_last_update_utc` and
  `time_next_update_utc` — **use them** rather than assuming, and store `time_last_update_utc`
  as the rate's `as_of`.
- Verified 2026-08-25: `USD→COP 3042.806266`, `USD→EUR 0.857211`.

**Cross-check: Colombia's official TRM** (`datos.gov.co`, SODA dataset `32sa-8pi3`)

- Keyless, authoritative, but **COP/USD only** — it is a cross-check, not a provider.
- Fields: `valor` (COP per USD), `vigenciadesde`, `vigenciahasta`. Note `vigenciahasta` spans
  weekends and holidays — one TRM row can cover three days.
- Verified 2026-08-25: TRM `3056.51`, against the primary's `3042.81`. **A 0.45% disagreement, on
  the same day, from two legitimate sources.**

That last number is the whole argument for how this app handles rates. There is no single true
COP/USD rate — there is a rate *from a source*, *on a date*. So every stored rate carries its
source and its date, every pinned rate records both, and the UI is able to say where a number
came from. `FX_TRM_CROSSCHECK=true` logs a warning when the two disagree beyond a threshold; it
never silently picks one.

Providers sit behind one interface in `src/server/fx/providers/`. Adding or replacing one must
not touch the conversion math or the pinning logic.

## Storing rates

```
fx_rates (base_currency, quote_currency, rate, as_of, source, fetched_at)
  unique (base_currency, quote_currency, as_of, source)
```

- `rate` is `numeric(20,10)` — quote units per **1** base unit. Read it as a **string** and parse
  to a scaled `bigint`; never let it become a JS float.
- Fetched against `FX_BASE_CURRENCY` (USD). Cross rates are derived:
  `COP→EUR = (USD→EUR) / (USD→COP)`.
- **History is append-only.** Never overwrite a past day's rate — a pinned group may reference it,
  and rewriting it would move totals that were promised not to move.
- Upsert is keyed on `(base, quote, as_of, source)`, so re-running the refresh is a no-op.

## The daily refresh

```
systemd timer (host, daily)  →  POST /api/admin/fx/refresh
                                Authorization: Bearer $FX_REFRESH_TOKEN
```

Triggered from outside the container, mirroring the deploy-timer idiom already in use on this
host. Not an in-process `setInterval` — that dies with the container and stops being a schedule
without telling anyone.

- **Idempotent.** Same day, same source, run it ten times: one row.
- **`FX_REFRESH_TOKEN` unset disables the endpoint** with a `404`, rather than leaving it
  unauthenticated. A misconfigured deploy must fail closed.
- Rate-limited and never enumerable — it is an ops endpoint, not a user one.
- Schedule it a little after the provider publishes (~00:00–00:30 UTC), with a randomized delay
  so it isn't hammering the top of the hour. `02:00 UTC` is a sane default.
- `npm run fx:refresh` runs the identical code path locally, for debugging.

**Lazy fallback.** If a conversion needs a rate and there is none within the staleness window, the
service fetches on demand rather than failing. A missed timer must never be the reason a member
can't convert their group. If *that* fetch also fails, the conversion returns a typed error naming
the missing pair and date — it does not fall back to a stale rate silently.

**Staleness.** A rate older than 7 days is refused for a *new* pin. Already-pinned groups are
unaffected, by design.

## Display currency — the reversible conversion

A group has an optional `display_currency`. Setting it does **not** rewrite a single expense
([ADR-0007](../adr/0007-reversible-display-currency.md)). It writes:

```
groups.display_currency        = 'USD'
group_fx_pins (group_id, from_currency, to_currency, rate, as_of, source, pinned_at, pinned_by)
```

One pin row per currency present in the group. The pins are the **derived cross rates**, stored
directly, so read-time conversion is one multiplication and never re-derives anything. That also
means changing `FX_BASE_CURRENCY` later cannot move an already-pinned group.

**Pins never refresh themselves.** Once a group converts, its totals stop moving until a member
explicitly re-pins. This is exactly what was asked for — "if the rate changed we're okay not
recalculating" — and it is a product promise, not an implementation detail. No background job,
no cache expiry, and no clever "the rate is stale, let me just update it" may touch a pin.

Clearing `display_currency` reverts everything to original currencies. The pin rows are **kept**,
not deleted, so re-enabling the same conversion reproduces the same numbers and the group has a
history of what it converted at and when.

### The conversion arithmetic

Rates are exact integers scaled by `10^10`, parsed from the decimal string by digit shifting —
**not** by `parseFloat(x) * 1e10`.

```
converted_minor = (amount_minor × rate_scaled × 10^(exp_target − exp_source) + 5×10^9) / 10^10
```

as `bigint` division, i.e. **half-up rounding**. All amounts are positive, so there is no
negative-rounding ambiguity to resolve.

Worked, with the verified rate above — `20.00 USD` at `USD→COP 3042.806266`:

```
amount_minor = 2000n                    (USD, exponent 2)
rate_scaled  = 30428062660000n          (3042.806266 × 10^10)
exponents equal → factor 1

(2000 × 30428062660000 + 5000000000) / 10000000000
  = 60856130320000000 / 10000000000
  = 6085613n                            → $ 60.856,13 COP
```

Conversion is applied **per row and then re-apportioned**, never to a net balance — that is what
keeps `Σ splits == total` true after conversion for every split strategy. The rule and the reason
are in [splitting.md](splitting.md) §6.

## Formatting

One shared formatter, in `src/lib/money/format.ts`. **Never call `Intl` directly in a component.**

Two verified behaviours it exists to paper over:

- `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` yields `$ 150.000,00`.
  CLDR gives COP two fraction digits; Colombians expect none. Pass
  `maximumFractionDigits: 0` for COP.
- `EUR` formatted under `es-CO` yields `EUR 45,00`, not `€45,00`. Pick the locale per currency, or
  set `currencyDisplay` explicitly.

When a group is showing converted amounts, the UI must say so — a converted total is labelled
with its display currency, the pin date, and the source, reachable in one tap. A number that
quietly changed currency is the fastest way to lose a user's trust in a money app.
