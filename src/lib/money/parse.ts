import { InvalidAmountError, NonPositiveAmountError } from "./errors";
import { assertSameCurrency, type Money } from "./types";

/**
 * Explicit digits-only check before `BigInt()` — `BigInt()` alone accepts
 * things you don't want (`"1e9"` actually throws, but a stray `Number`
 * coercion elsewhere on the same string wouldn't) and this repo can't
 * afford a silently truncated amount. Rejects scientific notation,
 * whitespace, decimals, signs, and the empty string — a minor-unit amount
 * is always a non-negative integer with no separators.
 */
const DIGITS_ONLY = /^[0-9]+$/;

export function parseMinorUnits(input: string): bigint {
  if (!DIGITS_ONLY.test(input)) throw new InvalidAmountError(input);
  return BigInt(input);
}

/** All amounts in this app are strictly positive — a refund is a settlement, not a negative expense. */
export function assertPositive(amount: bigint): void {
  if (amount <= 0n) throw new NonPositiveAmountError(amount);
}

/** Throws CurrencyMismatchError for two different currencies — there is no implicit conversion here. */
export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

/** -1 / 0 / 1, like Array.prototype.sort's comparator. Throws for a currency mismatch. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amount < b.amount) return -1;
  if (a.amount > b.amount) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return compare(a, b) === 0;
}
