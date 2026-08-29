import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import {
  type ConvertibleAmounts,
  convertExpenseAmounts,
  convertMinorUnits,
  deriveCrossRateScaled,
  formatRateScaled,
  parseRateScaled,
  RATE_SCALE_FACTOR,
} from "../../lib/money/convert";
import { assertGroupNotArchived, requireMembership } from "../auth/membership";
import { getRateProvider } from "../fx/providers";
import { findLatestRate, refreshCore, type RefreshResult } from "../fx/refresh-core";
import { config } from "../config";
import { db, withTransaction } from "../db/client";
import { currencies, expenses, groupFxPins, groups, settlements } from "../db/schema";
import { ValidationError } from "../errors";
import { assertSupportedCurrency } from "./currencies";
import type { Group } from "./groups";

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

const PIN_STALENESS_DAYS = 7;

/** The most recent stored rate for a *new* pin is older than the staleness window — not raised for an already-existing pin, which is never re-checked (ADR-0007). */
export class RateTooStaleError extends ValidationError {
  constructor(currency: string, asOf: string) {
    super(
      "RATE_TOO_STALE",
      `The most recent rate for ${currency} is from ${asOf}, older than ${PIN_STALENESS_DAYS} days`,
      { currency, asOf },
    );
    this.name = "RateTooStaleError";
  }
}

function daysBetween(earlier: string, later: string): number {
  const ms = Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * The scaled USD rate a pin's cross-rate math needs for one leg —
 * `1.0` by definition when `currency` is the base itself (never fetched
 * or stored; there is no `fx_rates` row for a currency against itself).
 * Otherwise prefers a fresh fetch (`ensureRate`, same lazy path a read
 * would use); if that fails, falls back to whatever's already stored,
 * but only when it's within the 7-day staleness window — a `PUT` is a
 * deliberate, explicit action, so this refuses rather than silently
 * pinning a stretched-thin number when both the provider and a recent
 * rate are simultaneously unavailable.
 */
async function usdRateForPin(currency: string, today: string): Promise<bigint> {
  if (currency === config.FX_BASE_CURRENCY) return RATE_SCALE_FACTOR;

  try {
    const fresh = await ensureRate(currency);
    return parseRateScaled(fresh.rate);
  } catch (error) {
    if (!(error instanceof RateUnavailableError)) throw error;
    const existing = await findLatestRate(db, config.FX_BASE_CURRENCY, currency, getRateProvider().source);
    if (!existing) throw error;
    if (daysBetween(existing.asOf, today) > PIN_STALENESS_DAYS) {
      throw new RateTooStaleError(currency, existing.asOf);
    }
    return parseRateScaled(existing.rate);
  }
}

/** Distinct currencies with any live (non-deleted) activity in the group — expenses and settlements alike. */
async function currenciesPresentIn(groupId: string): Promise<string[]> {
  const rows = await union(
    db
      .selectDistinct({ currency: expenses.currency })
      .from(expenses)
      .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt))),
    db
      .selectDistinct({ currency: settlements.currency })
      .from(settlements)
      .where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt))),
  );
  return rows.map((row) => row.currency);
}

export interface Pin {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: string;
  source: string;
}

function toPin(row: typeof groupFxPins.$inferSelect): Pin {
  return { fromCurrency: row.fromCurrency, toCurrency: row.toCurrency, rate: row.rate, asOf: row.asOf, source: row.source };
}

/**
 * Sets `groups.display_currency` and writes one pin per currency present
 * in the group, storing the **derived cross rate directly** — read-time
 * conversion is one multiplication and never re-derives (ADR-0007).
 * Touches no expense row. All rate fetching happens *before* the
 * transaction opens (it may hit the network); the transaction itself is
 * just the two fast, all-or-nothing writes.
 *
 * Re-`PUT`ting the same `currency` re-pins at today's rates — the *only*
 * thing that moves an already-converted group's numbers, and always an
 * explicit action (`onConflictDoUpdate`, not a plain insert).
 */
export async function setDisplayCurrency(
  groupId: string,
  userId: string,
  currency: string,
): Promise<{ group: Group; pins: Pin[] }> {
  await requireMembership(groupId, userId);
  const [existing] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(existing!);
  assertSupportedCurrency(currency);

  const today = todayUtcDate();
  const present = (await currenciesPresentIn(groupId)).filter((from) => from !== currency);

  const pinValues: (typeof groupFxPins.$inferInsert)[] = [];
  if (present.length > 0) {
    const toRateScaled = await usdRateForPin(currency, today);
    for (const fromCurrency of present) {
      const fromRateScaled = await usdRateForPin(fromCurrency, today);
      pinValues.push({
        groupId,
        fromCurrency,
        toCurrency: currency,
        rate: formatRateScaled(deriveCrossRateScaled(toRateScaled, fromRateScaled)),
        asOf: today,
        source: getRateProvider().source,
        pinnedBy: userId,
        pinnedAt: new Date(),
      });
    }
  }

  const [group, pins] = await withTransaction(async (tx) => {
    const [updatedGroup] = await tx
      .update(groups)
      .set({ displayCurrency: currency, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning();

    const writtenPins: (typeof groupFxPins.$inferSelect)[] = [];
    for (const values of pinValues) {
      const [row] = await tx
        .insert(groupFxPins)
        .values(values)
        .onConflictDoUpdate({
          target: [groupFxPins.groupId, groupFxPins.fromCurrency, groupFxPins.toCurrency],
          set: {
            rate: values.rate,
            asOf: values.asOf,
            source: values.source,
            pinnedAt: values.pinnedAt,
            pinnedBy: values.pinnedBy,
          },
        })
        .returning();
      writtenPins.push(row!);
    }
    return [updatedGroup!, writtenPins];
  });

  return { group, pins: pins.map(toPin) };
}

/** Reverts to per-currency display. The pin rows are kept, untouched — re-`PUT`ting the same currency later reproduces the exact same numbers (ADR-0007). */
export async function clearDisplayCurrency(groupId: string, userId: string): Promise<{ group: Group }> {
  await requireMembership(groupId, userId);
  const [existing] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  assertGroupNotArchived(existing!);

  const [group] = await db
    .update(groups)
    .set({ displayCurrency: null, updatedAt: new Date() })
    .where(eq(groups.id, groupId))
    .returning();
  return { group: group! };
}

export async function getDisplayCurrency(
  groupId: string,
  userId: string,
): Promise<{ currency: string | null; pins: Pin[]; source: string }> {
  await requireMembership(groupId, userId);
  const [group] = await db.select({ displayCurrency: groups.displayCurrency }).from(groups).where(eq(groups.id, groupId)).limit(1);
  const pinRows = await db.select().from(groupFxPins).where(eq(groupFxPins.groupId, groupId));
  // `source` is the provider a conversion *would* pin from — surfaced so the
  // Ajustes tab's convert confirmation can name the rate's provenance
  // (source + today's date) before the write, not only after (T068).
  return { currency: group!.displayCurrency, pins: pinRows.map(toPin), source: getRateProvider().source };
}

/**
 * Everything the read path (T054) needs to convert a group's activity
 * into its display currency, fetched once per request rather than once
 * per expense — `ratesByFromCurrency`/`exponentsByCurrency` are tiny maps
 * a whole balances/expenses response shares. `currencies` has no
 * `server-only` guard of its own, but this lives here (not
 * `services/currencies.ts`) because it's inseparable from the pins query
 * it's always fetched alongside.
 */
export interface ConversionContext {
  displayCurrency: string;
  ratesByFromCurrency: Map<string, bigint>;
  exponentsByCurrency: Map<string, number>;
  pins: Pin[];
}

export async function loadConversionContext(groupId: string, displayCurrency: string): Promise<ConversionContext> {
  const [pinRows, currencyRows] = await Promise.all([
    db
      .select()
      .from(groupFxPins)
      .where(and(eq(groupFxPins.groupId, groupId), eq(groupFxPins.toCurrency, displayCurrency))),
    db.select({ code: currencies.code, exponent: currencies.exponent }).from(currencies),
  ]);

  return {
    displayCurrency,
    ratesByFromCurrency: new Map(pinRows.map((row) => [row.fromCurrency, parseRateScaled(row.rate)])),
    exponentsByCurrency: new Map(currencyRows.map((row) => [row.code, row.exponent])),
    pins: pinRows.map(toPin),
  };
}

function rateFor(ctx: ConversionContext, currency: string): bigint {
  const rateScaled = ctx.ratesByFromCurrency.get(currency);
  if (!rateScaled) throw new RateUnavailableError(currency, ctx.displayCurrency, todayUtcDate());
  return rateScaled;
}

/**
 * Converts one expense's total/payers/splits into `ctx.displayCurrency`
 * (splitting.md § 6) — a pass-through when the expense is already in
 * that currency, since there's nothing to convert. `seed` must be the
 * expense id, so the re-apportionment lands the same way every time it's
 * read (`convertExpenseAmounts`'s own contract).
 *
 * A currency present in the ledger with no matching pin — e.g. a member
 * added an expense in a new currency after the group last pinned — is
 * `RATE_UNAVAILABLE`, the same code the display-currency `PUT` uses for
 * an unresolvable pair. Never silently shown unconverted or dropped.
 */
export function convertAmounts(
  ctx: ConversionContext,
  currency: string,
  seed: string,
  amounts: ConvertibleAmounts,
): { currency: string } & ConvertibleAmounts {
  if (currency === ctx.displayCurrency) return { currency, ...amounts };

  const rateScaled = rateFor(ctx, currency);
  const sourceExponent = ctx.exponentsByCurrency.get(currency)!;
  const targetExponent = ctx.exponentsByCurrency.get(ctx.displayCurrency)!;
  const converted = convertExpenseAmounts(amounts, rateScaled, sourceExponent, targetExponent, seed);
  return { currency: ctx.displayCurrency, ...converted };
}

/** Settlements convert as a single amount — nothing to apportion (splitting.md § 6). */
export function convertSettlementAmount(
  ctx: ConversionContext,
  currency: string,
  amount: bigint,
): { currency: string; amount: bigint } {
  if (currency === ctx.displayCurrency) return { currency, amount };

  const rateScaled = rateFor(ctx, currency);
  const sourceExponent = ctx.exponentsByCurrency.get(currency)!;
  const targetExponent = ctx.exponentsByCurrency.get(ctx.displayCurrency)!;
  return { currency: ctx.displayCurrency, amount: convertMinorUnits(amount, rateScaled, sourceExponent, targetExponent) };
}
