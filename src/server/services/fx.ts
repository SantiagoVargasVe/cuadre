import "server-only";
import { getRateProvider } from "../fx/providers";
import { findLatestRate, refreshCore, type RefreshResult } from "../fx/refresh-core";
import { config } from "../config";
import { db } from "../db/client";
import { ValidationError } from "../errors";

/** A conversion needed a rate that doesn't exist and couldn't be fetched — never a silent stale fallback. */
export class RateUnavailableError extends ValidationError {
  constructor(from: string, to: string, date: string) {
    super("RATE_UNAVAILABLE", `No exchange rate available for ${from}→${to} on ${date}`, {
      from,
      to,
      date,
    });
    this.name = "RateUnavailableError";
  }
}

/**
 * The daily refresh, for both the admin route and `scripts/fx-refresh.ts`
 * — thin wrapper supplying the app's own `db` and configured provider to
 * the shared, server-only-free `refreshCore` (ADR-0008).
 */
export async function refreshRates(): Promise<RefreshResult> {
  return refreshCore(
    db,
    getRateProvider(),
    config.FX_BASE_CURRENCY,
    config.SUPPORTED_CURRENCIES,
    config.FX_TRM_CROSSCHECK,
  );
}

function todayUtcDate(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Dedupes concurrent refreshes into one in-flight call (currency.md §
 * Lazy fallback: "concurrent lazy fetches ... don't stampede the
 * provider"). An in-memory `Promise` is enough for this app's single
 * container (architecture.md) — a multi-instance deployment would need a
 * Postgres advisory lock instead, since each instance would have its own
 * copy of this module-level variable.
 */
let inFlightRefresh: Promise<RefreshResult> | null = null;

function refreshOnce(): Promise<RefreshResult> {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshRates().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * The rate a conversion needs, fetching on demand if today's isn't in the
 * database yet — a missed timer run must never be why a member can't
 * convert their group. The provider only ever answers for "today," so
 * "within the staleness window" collapses to "does a row already exist
 * for today's date": if so, that row already came from today's refresh
 * (scheduled or lazy) and is used as-is; if not, one shared refresh is
 * triggered and re-read.
 *
 * If the refresh itself fails (provider down, network error, a
 * currency missing from the response), that failure is deliberately not
 * surfaced as-is — it becomes a typed `RateUnavailableError` naming
 * exactly the missing pair and date, never a silent fall back to
 * whatever the last stored rate happened to be.
 */
export async function ensureRate(quoteCurrency: string): Promise<{ rate: string; source: string; asOf: string }> {
  const today = todayUtcDate();
  const source = getRateProvider().source;
  const base = config.FX_BASE_CURRENCY;

  const existing = await findLatestRate(db, base, quoteCurrency, source);
  if (existing?.asOf === today) return { rate: existing.rate, source, asOf: today };

  try {
    await refreshOnce();
  } catch {
    throw new RateUnavailableError(base, quoteCurrency, today);
  }

  const refreshed = await findLatestRate(db, base, quoteCurrency, source);
  if (!refreshed || refreshed.asOf !== today) {
    throw new RateUnavailableError(base, quoteCurrency, today);
  }
  return { rate: refreshed.rate, source, asOf: today };
}
