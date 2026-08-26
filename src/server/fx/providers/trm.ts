import { z } from "zod";
import { parseRateScaled } from "../../../lib/money/convert";
import { InvalidProviderResponseError, TrmRateNotFoundError } from "./errors";
import { fetchWithRetry } from "./http";

export const TRM_SOURCE = "trm";

/**
 * `valor` is already a JSON **string** in this SODA dataset — Socrata's
 * own convention for numeric fields, precisely to avoid the float
 * problem `open-er-api.ts` has to work around by hand. Nothing here goes
 * through `Number` at any point.
 */
const trmRowSchema = z.object({
  valor: z.string(),
  vigenciadesde: z.string(),
  vigenciahasta: z.string(),
});
const trmResponseSchema = z.array(trmRowSchema);

export interface TrmRate {
  /** COP per 1 USD, as a decimal string — COP/USD only, a cross-check, not a provider (currency.md). */
  rate: string;
  asOf: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
}

/**
 * `vigenciahasta` spans weekends and holidays — a Friday's row can cover
 * Friday through Sunday, so "the row for `asOf`" means the row whose
 * `[vigenciadesde, vigenciahasta]` window *contains* `asOf`, not
 * necessarily the most recent one. Fetches a small page of recent rows
 * (ordered newest-first) and filters client-side, rather than trusting a
 * SoQL date-range query string built by hand.
 */
export async function fetchTrmRate(asOf: string): Promise<TrmRate> {
  const response = await fetchWithRetry(
    "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=10",
  );
  const rawBody = await response.text();

  const parsed = trmResponseSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) throw new InvalidProviderResponseError(TRM_SOURCE, parsed.error.message);

  const match = parsed.data.find((row) => {
    const desde = row.vigenciadesde.slice(0, 10);
    const hasta = row.vigenciahasta.slice(0, 10);
    return desde <= asOf && asOf <= hasta;
  });
  if (!match) throw new TrmRateNotFoundError(asOf);

  return {
    rate: match.valor,
    asOf,
    vigenciaDesde: match.vigenciadesde.slice(0, 10),
    vigenciaHasta: match.vigenciahasta.slice(0, 10),
  };
}

/**
 * A 1% gap is well above the 0.45% divergence ADR-0008 measured between
 * these two legitimate sources on an ordinary day — routine noise
 * shouldn't page anyone — while still catching a real anomaly (a stale
 * fetch, a provider outage returning garbage, a currency mix-up).
 */
const DIVERGENCE_THRESHOLD_BP = 100n;

/**
 * `FX_TRM_CROSSCHECK=true`'s comparison (currency.md): logs a warning past
 * the threshold and **returns**, never throws — there is no single true
 * rate to prefer between two legitimate sources, so this never picks a
 * winner, only flags disagreement for a human to see.
 */
export function checkTrmDivergence(primaryRate: string, trmRate: string, asOf: string): void {
  const primaryScaled = parseRateScaled(primaryRate);
  const trmScaled = parseRateScaled(trmRate);
  const diff = primaryScaled > trmScaled ? primaryScaled - trmScaled : trmScaled - primaryScaled;
  const diffBp = (diff * 10000n) / primaryScaled;

  if (diffBp >= DIVERGENCE_THRESHOLD_BP) {
    console.warn(
      `FX cross-check: open-er-api (${primaryRate}) and TRM (${trmRate}) disagree by ` +
        `${diffBp} bp on ${asOf} for USD→COP. Neither source is wrong — see currency.md.`,
    );
  }
}
