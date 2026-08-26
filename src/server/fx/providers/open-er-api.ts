import { z } from "zod";
import { InvalidProviderResponseError, MissingCurrencyError, ProviderReturnedErrorError } from "./errors";
import { fetchWithRetry } from "./http";
import type { ProviderRates, RateProvider } from "./types";

const SOURCE = "open-er-api";

const successSchema = z.object({
  result: z.literal("success"),
  time_last_update_utc: z.string(),
  base_code: z.string(),
  // Validates *shape* only — every value really is a JSON number here.
  // The value this module actually returns comes from extractRawRate()
  // below, reading the wire text directly, not this parsed number: see
  // its own doc comment for why.
  rates: z.record(z.string(), z.number()),
});
const errorSchema = z.object({ result: z.literal("error"), "error-type": z.string() });
const responseSchema = z.union([successSchema, errorSchema]);

/**
 * `time_last_update_utc` is an RFC-1123-ish string ("Wed, 26 Aug 2026
 * 00:02:31 +0000") — parseable by `Date`, but the *day* it names is a UTC
 * calendar day (the provider publishes once daily at UTC midnight), so
 * this reads UTC fields rather than local ones to avoid shifting the date
 * for a server not running in UTC.
 */
function toAsOfDate(source: string, utcString: string): string {
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidProviderResponseError(source, `unparseable time_last_update_utc: "${utcString}"`);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The provider transmits rates as bare JSON numbers, not strings — unlike
 * our own `fx_rates.rate` column, this app doesn't control that wire
 * format. `response.json()` would hand back a value that's already been
 * through `JSON.parse`'s double conversion, which is exactly the
 * `parseFloat`-shaped mistake currency.md warns against (splitting.md §1)
 * — a reviver can't undo it either, since it only ever sees the
 * already-parsed number, not the source digits.
 *
 * Reading the *raw response text* and regex-matching `"CODE":<digits>`
 * directly extracts the exact characters the server sent, with zero float
 * conversion anywhere in the path. This is safe against real, well-formed
 * JSON specifically because object keys are unique and quoted — a key
 * can't appear as a substring of another key without also being invalid
 * JSON — so matching on `"CODE":` unambiguously locates that key's value.
 */
function extractRawRate(rawBody: string, currencyCode: string): string | undefined {
  const pattern = new RegExp(`"${currencyCode}":(-?\\d+(?:\\.\\d+)?)`);
  return pattern.exec(rawBody)?.[1];
}

export const openErApiProvider: RateProvider = {
  async fetchRates(baseCurrency, quoteCurrencies) {
    const response = await fetchWithRetry(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    const rawBody = await response.text();

    const parsed = responseSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      throw new InvalidProviderResponseError(SOURCE, parsed.error.message);
    }
    if (parsed.data.result === "error") {
      throw new ProviderReturnedErrorError(SOURCE, parsed.data["error-type"]);
    }

    const asOf = toAsOfDate(SOURCE, parsed.data.time_last_update_utc);
    const rates: Record<string, string> = {};
    for (const code of quoteCurrencies) {
      const rate = extractRawRate(rawBody, code);
      if (rate === undefined) throw new MissingCurrencyError(SOURCE, code);
      rates[code] = rate;
    }

    return { baseCurrency, asOf, source: SOURCE, rates } satisfies ProviderRates;
  },
};
