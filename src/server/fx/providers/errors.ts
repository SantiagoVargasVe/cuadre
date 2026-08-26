/**
 * Plain `Error` subclasses, not `server/errors.ts`'s `DomainError` — these
 * aren't thrown from a route handler directly. T052's refresh endpoint
 * catches and remaps them; test code matches on `instanceof`.
 */

/** The HTTP request itself failed — network error, timeout, or a non-2xx status, after retrying. */
export class ProviderRequestFailedError extends Error {
  readonly url: string;
  constructor(url: string, cause?: unknown) {
    super(`Request to ${url} failed${cause instanceof Error ? `: ${cause.message}` : ""}`);
    this.name = "ProviderRequestFailedError";
    this.url = url;
  }
}

/** The response body doesn't match the shape this provider expects at all. */
export class InvalidProviderResponseError extends Error {
  readonly source: string;
  constructor(source: string, detail: string) {
    super(`${source} returned an unexpected response: ${detail}`);
    this.name = "InvalidProviderResponseError";
    this.source = source;
  }
}

/** The provider itself reported failure (open.er-api.com's `result: "error"`). */
export class ProviderReturnedErrorError extends Error {
  readonly source: string;
  readonly errorType: string;
  constructor(source: string, errorType: string) {
    super(`${source} reported an error: ${errorType}`);
    this.name = "ProviderReturnedErrorError";
    this.source = source;
    this.errorType = errorType;
  }
}

/**
 * A currency this app needs wasn't in the response. Thrown before
 * anything is returned — a caller never sees a `ProviderRates` with a
 * silently-missing entry (currency.md's "never a partial write").
 */
export class MissingCurrencyError extends Error {
  readonly source: string;
  readonly currency: string;
  constructor(source: string, currency: string) {
    super(`${source} did not return a rate for ${currency}`);
    this.name = "MissingCurrencyError";
    this.source = source;
    this.currency = currency;
  }
}

/** The TRM cross-check has no row whose validity window covers the requested date. */
export class TrmRateNotFoundError extends Error {
  readonly asOf: string;
  constructor(asOf: string) {
    super(`No TRM rate covers ${asOf}`);
    this.name = "TrmRateNotFoundError";
    this.asOf = asOf;
  }
}
