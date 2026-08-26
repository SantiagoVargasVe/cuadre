/**
 * One provider's fetch, already validated and reduced to exactly the
 * currencies this app needs. `rates` values are decimal **strings** —
 * quote units per 1 `baseCurrency` unit — ready for
 * `src/lib/money/convert.ts`'s `parseRateScaled`, never a JS number.
 */
export interface ProviderRates {
  baseCurrency: string;
  /** YYYY-MM-DD, the date the provider itself says this rate is for — never "today" assumed. */
  asOf: string;
  source: string;
  rates: Record<string, string>;
}

/**
 * One method, swappable without touching conversion math or pinning
 * (currency.md § Choosing a provider). Implementations must throw rather
 * than return a partial `rates` map — a caller that gets a `ProviderRates`
 * back can trust every currency it asked for is present.
 */
export interface RateProvider {
  /** The exact `source` string this provider stamps on every rate it returns — read this rather than assuming it matches `config.FX_PROVIDER`'s spelling. */
  readonly source: string;
  fetchRates(baseCurrency: string, quoteCurrencies: readonly string[]): Promise<ProviderRates>;
}
