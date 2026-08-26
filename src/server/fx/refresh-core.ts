import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { fxRates } from "../db/schema";
import { checkTrmDivergence, fetchTrmRate } from "./providers/trm";
import type { RateProvider } from "./providers/types";

export interface RefreshResult {
  inserted: number;
  asOf: string;
  source: string;
}

/**
 * Fetches every `quoteCurrencies` rate against `baseCurrency` and upserts
 * each into `fx_rates`, `ON CONFLICT ... DO NOTHING` — idempotent per
 * `(base, quote, as_of, source)` (ten runs, one row), never an `UPDATE`,
 * since the table is append-only (currency.md). The base currency itself
 * is skipped: the provider reports it at rate 1 (it's asking "USD in
 * USD"), and a self-pair row would never be read by anything.
 *
 * No `import "server-only"` — this is the one function the daily-refresh
 * route, the lazy fallback, and `scripts/fx-refresh.ts` all call, so it
 * can't depend on anything that throws outside Next (ADR-0008: "`npm run
 * fx:refresh` runs the identical code path locally"). Callers supply
 * their own `db` and `provider` instead of reaching for the app
 * singletons themselves.
 *
 * The TRM cross-check is folded in here too, not layered on top by
 * `services/fx.ts` alone — the script gets the exact same warning
 * behavior as the timer, which is the whole point of "identical code
 * path." It's best-effort: a TRM fetch failure is logged and swallowed,
 * never turned into a failed refresh — TRM is a cross-check, not a
 * dependency (currency.md).
 */
export async function refreshCore(
  db: Db,
  provider: RateProvider,
  baseCurrency: string,
  quoteCurrencies: readonly string[],
  runTrmCrossCheck: boolean,
): Promise<RefreshResult> {
  const fetched = await provider.fetchRates(baseCurrency, quoteCurrencies);

  let inserted = 0;
  for (const quoteCurrency of quoteCurrencies) {
    if (quoteCurrency === baseCurrency) continue;

    const rows = await db
      .insert(fxRates)
      .values({
        baseCurrency,
        quoteCurrency,
        rate: fetched.rates[quoteCurrency]!,
        asOf: fetched.asOf,
        source: fetched.source,
      })
      .onConflictDoNothing({
        target: [fxRates.baseCurrency, fxRates.quoteCurrency, fxRates.asOf, fxRates.source],
      })
      .returning();
    inserted += rows.length;
  }

  if (runTrmCrossCheck && baseCurrency === "USD" && "COP" in fetched.rates) {
    try {
      const trm = await fetchTrmRate(fetched.asOf);
      checkTrmDivergence(fetched.rates.COP!, trm.rate, fetched.asOf);
    } catch (error) {
      console.warn("FX cross-check: TRM fetch failed, skipping comparison:", error);
    }
  }

  return { inserted, asOf: fetched.asOf, source: fetched.source };
}

/** The freshest stored rate for `(baseCurrency, quoteCurrency, source)`, or `undefined` if none exists yet. */
export async function findLatestRate(
  db: Db,
  baseCurrency: string,
  quoteCurrency: string,
  source: string,
): Promise<{ rate: string; asOf: string } | undefined> {
  const [row] = await db
    .select({ rate: fxRates.rate, asOf: fxRates.asOf })
    .from(fxRates)
    .where(
      and(
        eq(fxRates.baseCurrency, baseCurrency),
        eq(fxRates.quoteCurrency, quoteCurrency),
        eq(fxRates.source, source),
      ),
    )
    .orderBy(desc(fxRates.asOf))
    .limit(1);
  return row;
}
