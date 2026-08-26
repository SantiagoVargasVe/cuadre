import { CurrencyMismatchError } from "./errors";

/**
 * The type every money task builds on (splitting.md §1, ADR-0004).
 *
 * `src/lib/money/` imports nothing — no Drizzle, no Next, no config, no
 * I/O — so it can be tested exhaustively and services call in while it
 * never calls out. This module does not know COP is special: currency
 * metadata (exponent, display decimals) is read from the `currencies`
 * table by the caller and passed to whichever function needs it (T031,
 * T054, T061) rather than looked up here.
 */

/** An ISO-4217 code. Not a literal union — new currencies are data, not a code change. */
export type CurrencyCode = string;

/** An integer count of minor units plus its currency. Never a float, never a bare number. */
export interface Money {
  amount: bigint;
  currency: CurrencyCode;
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}
