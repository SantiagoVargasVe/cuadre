import { z } from "zod";

const currencyCode = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code");

/**
 * `GET /api/groups/:id/fx-quote?from=USD&to=COP` — a read-only rate quote
 * for an arbitrary pair, so the settle-up form can spell out the transfer
 * amount (T104). It never writes a pin; `assertSupportedCurrency` and
 * membership are checked in the service.
 */
export const fxQuoteQuerySchema = z.object({
  from: currencyCode,
  to: currencyCode,
});
export type FxQuoteQuery = z.infer<typeof fxQuoteQuerySchema>;

/** The `{ rate, asOf, source }` shape the rest of the app already speaks. */
export interface FxQuote {
  /** Quote units of `to` per 1 unit of `from`, as a `numeric(20,10)` string. */
  rate: string;
  /** The rate's date, `YYYY-MM-DD`. */
  asOf: string;
  /** The FX provider it came from — currency.md: two sources disagreed 0.45%. */
  source: string;
}
