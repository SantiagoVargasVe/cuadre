import { UnknownCurrencyError } from "./errors";
import type { Money } from "./types";

/** The one locale this app renders in — see CLAUDE.md "Spanish-first". */
const LOCALE = "es-CO";

export interface CurrencyMeta {
  /** ISO-4217 minor-unit exponent. */
  exponent: number;
  /** How many of those minor-unit digits are actually shown — and, for
   * `<MoneyField>`, how many the user is allowed to type. */
  displayDecimals: number;
}

/**
 * Mirrors the seed in migrations/0002_groups_currencies_members.sql — the
 * one other place this exact data lives. `src/lib/money/` has no DB access
 * (types.ts § intro), so this is a small static table rather than a query,
 * kept in sync by hand the same way adding a currency already touches
 * several files (currency.md § Supported currencies).
 */
const CURRENCY_META: Record<string, CurrencyMeta> = {
  COP: { exponent: 2, displayDecimals: 0 },
  USD: { exponent: 2, displayDecimals: 2 },
  EUR: { exponent: 2, displayDecimals: 2 },
};

export function getCurrencyMeta(currency: string): CurrencyMeta {
  const meta = CURRENCY_META[currency];
  if (!meta) throw new UnknownCurrencyError(currency);
  return meta;
}

/** The currencies this display layer knows how to render — for a currency
 * picker. Mirrors `SUPPORTED_CURRENCIES` (currency.md § *Supported
 * currencies*); the server is still the source of truth that validates a
 * choice, this just keeps a picker from offering one it can't format. */
export const KNOWN_CURRENCIES: readonly string[] = Object.keys(CURRENCY_META);

/**
 * The locale's own separator glyphs, asked from `Intl` once rather than
 * hardcoded — `es-CO` uses `,` for decimals, but this is the one file
 * allowed to know that, and asking is cheaper than another gotcha to
 * maintain by hand.
 */
const DECIMAL_SEPARATOR = new Intl.NumberFormat(LOCALE)
  .formatToParts(1.1)
  .find((part) => part.type === "decimal")!.value;

const PLUS_SIGN = new Intl.NumberFormat(LOCALE, { signDisplay: "exceptZero" })
  .formatToParts(1)
  .find((part) => part.type === "plusSign")!.value;

const MINUS_SIGN = new Intl.NumberFormat(LOCALE, { signDisplay: "exceptZero" })
  .formatToParts(-1)
  .find((part) => part.type === "minusSign")!.value;

export interface FormatMoneyOptions {
  /** Prefixes a positive amount with `+`, per design-system.md § *Money display*. */
  signed?: boolean;
}

/**
 * The only place `Intl.NumberFormat` runs on a money value (design-system.md
 * § *Money display*). Two verified gotchas it exists to absorb:
 *
 * - `Intl.NumberFormat('es-CO', { currency: 'COP' })` defaults to two
 *   fraction digits (CLDR), so `maximumFractionDigits` has to come from
 *   `displayDecimals`, never the ISO exponent.
 * - `currencyDisplay: 'symbol'` renders EUR as the literal string `EUR`
 *   under `es-CO`, not `€` — `narrowSymbol` fixes it for every currency
 *   this app supports.
 *
 * The amount is split into major/minor parts with `bigint` arithmetic and
 * handed to `Intl` as a `bigint` — never a `Number` — so a COP amount past
 * `Number.MAX_SAFE_INTEGER` still formats exactly (splitting.md § 1).
 *
 * The sign is computed from `value.amount`, not from the truncated major
 * part: a value like `-50n` at exponent 2 is `-0.50`, whose major part is
 * `0n` — bigint division truncates toward zero, so `0n` carries no sign of
 * its own, and `Intl` would silently drop the minus. Formatting the
 * absolute value and prepending the sign ourselves avoids that.
 */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const meta = getCurrencyMeta(value.currency);
  const divisor = 10n ** BigInt(meta.exponent);
  const isNegative = value.amount < 0n;
  const absAmount = isNegative ? -value.amount : value.amount;
  const majorPart = absAmount / divisor;

  const parts = new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: value.currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    signDisplay: "never",
  }).formatToParts(majorPart);

  // Zero gets no sign either way — "+$ 0" would contradict --settled being
  // a deliberate third state, not "a very small credit" (design-system.md).
  const sign = isNegative ? MINUS_SIGN : options.signed && value.amount > 0n ? PLUS_SIGN : "";
  const whole = sign + parts.map((part) => part.value).join("");
  if (meta.displayDecimals === 0) return whole;

  const minorRemainder = absAmount % divisor;
  const fraction = minorRemainder.toString().padStart(meta.exponent, "0");
  return `${whole}${DECIMAL_SEPARATOR}${fraction}`;
}

/** Every "." grouping separator es-CO's own Intl output uses — used to strip
 * grouping back out of a `<MoneyField>` value before re-deriving it. */
const GROUPING_SEPARATOR = new Intl.NumberFormat(LOCALE)
  .formatToParts(1000)
  .find((part) => part.type === "group")!.value;

/**
 * Reformats a `<MoneyField>`'s in-progress input with locale thousands
 * grouping as the user types (design-system.md § *Money display*):
 * `"150000"` → `"150.000"`. Never rejects — a character that doesn't
 * belong (a letter, a second decimal separator) is dropped rather than
 * refused, since nothing here can leave the field in a state the user
 * can't keep typing from.
 *
 * `currency` controls whether a decimal separator is allowed at all and
 * how many fraction digits follow it — COP's `displayDecimals` is `0`, so
 * a COP field never shows a comma, matching "Colombians never write
 * centavos" (splitting.md § 1).
 */
export function formatAmountInput(raw: string, currency: string): string {
  const meta = getCurrencyMeta(currency);
  const withoutGrouping = raw.split(GROUPING_SEPARATOR).join("");
  const commaIndex = withoutGrouping.indexOf(DECIMAL_SEPARATOR);
  // A comma typed into a zero-decimal field (COP) never becomes part of
  // the integer — everything from it onward is discarded, not absorbed.
  const hasTrailingSeparator = meta.displayDecimals > 0 && commaIndex !== -1;

  const rawIntegerPart = commaIndex !== -1 ? withoutGrouping.slice(0, commaIndex) : withoutGrouping;
  const integerDigits = rawIntegerPart.replace(/[^0-9]/g, "");
  const groupedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUPING_SEPARATOR);

  if (!hasTrailingSeparator) return groupedInteger;

  const fractionDigits = withoutGrouping
    .slice(commaIndex + 1)
    .replace(/[^0-9]/g, "")
    .slice(0, meta.displayDecimals);
  return `${groupedInteger}${DECIMAL_SEPARATOR}${fractionDigits}`;
}

/**
 * The other inverse of `parseAmountInput`: a `bigint` of minor units →
 * the grouped major-unit string a `<MoneyField>` expects as its
 * `defaultValue`. Needed anywhere a field is prefilled with a *computed*
 * amount (an apportioned default, a previously-typed value restored on
 * remount) rather than built up from the user's own keystrokes — passing
 * the raw minor-unit digits there would show e.g. `5000000` instead of
 * `50.000` for fifty thousand pesos.
 */
export function formatAmountInputValue(amount: bigint, currency: string): string {
  const meta = getCurrencyMeta(currency);
  const divisor = 10n ** BigInt(meta.exponent);
  const majorPart = amount / divisor;
  const groupedInteger = majorPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, GROUPING_SEPARATOR);
  if (meta.displayDecimals === 0) return groupedInteger;

  const minorRemainder = amount % divisor;
  const fraction = minorRemainder.toString().padStart(meta.exponent, "0").slice(0, meta.displayDecimals);
  return `${groupedInteger}${DECIMAL_SEPARATOR}${fraction}`;
}

/**
 * The inverse conversion, run once at the form boundary (design-system.md
 * § *Forms*): a `<MoneyField>`'s displayed string → a `bigint` of minor
 * units at `currency`'s ISO exponent. Missing or partial fraction digits
 * pad with zeros rather than erroring — an empty field is `0n`, left to
 * whatever "must be positive" validation runs downstream, not this
 * function's job to reject.
 */
export function parseAmountInput(raw: string, currency: string): bigint {
  const meta = getCurrencyMeta(currency);
  const withoutGrouping = raw.split(GROUPING_SEPARATOR).join("");
  const [integerPart = "", fractionPart = ""] = withoutGrouping.split(DECIMAL_SEPARATOR);

  const integerDigits = integerPart.replace(/[^0-9]/g, "") || "0";
  const fractionDigits = fractionPart
    .replace(/[^0-9]/g, "")
    .slice(0, meta.exponent)
    .padEnd(meta.exponent, "0");

  return BigInt(integerDigits) * 10n ** BigInt(meta.exponent) + BigInt(fractionDigits || "0");
}
