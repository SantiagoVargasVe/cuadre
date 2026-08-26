import { InvalidRateError } from "./errors";

/**
 * `fx_rates.rate`/`group_fx_pins.rate` are `numeric(20,10)` — quote units
 * per 1 base unit, scaled to an exact integer by shifting the decimal
 * point 10 places (currency.md § Storing rates). `10^RATE_SCALE` is that
 * scale factor, used everywhere a scaled rate needs to be turned back into
 * (or compared against) a real ratio.
 */
export const RATE_SCALE = 10;
export const RATE_SCALE_FACTOR = 10n ** BigInt(RATE_SCALE);

const DECIMAL_RATE = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a rate **string** into an exact `bigint` scaled by `10^10` —
 * never `parseFloat(x) * 1e10`, which silently rounds to a `Number`'s
 * ~15-16 significant digits before the multiply even happens, and a rate
 * pinned from that would quietly disagree with the same string parsed
 * again later. Digit-shifting instead: split on the decimal point, pad
 * the fractional part out to exactly `RATE_SCALE` digits with zeros, and
 * read the concatenated digits as one integer. A string with trailing
 * zeros already at (or short of) full scale parses to the identical
 * integer either way, because padding is idempotent past the actual
 * digits present.
 *
 * Rejects anything with a sign, exponent, or more than `RATE_SCALE`
 * fractional digits — a rate is always a positive, exact decimal with no
 * more precision than the column that stores it.
 */
export function parseRateScaled(rate: string): bigint {
  const match = DECIMAL_RATE.exec(rate.trim());
  if (!match) throw new InvalidRateError(rate);
  const [, intPart, fracPart = ""] = match;
  if (fracPart.length > RATE_SCALE) throw new InvalidRateError(rate);
  return BigInt(intPart! + fracPart.padEnd(RATE_SCALE, "0"));
}

/**
 * The inverse of `parseRateScaled` — a `10^RATE_SCALE`-scaled `bigint`
 * (e.g. a derived cross rate from `deriveCrossRateScaled`) back into a
 * decimal string fit to store in a `numeric(20,10)` column. Digit-
 * splitting again, not division-then-`toString`, for the same reason the
 * parse direction avoids `Number`: the scaled value is already exact, and
 * a float round-trip would be the one place that throws it away.
 */
export function formatRateScaled(scaled: bigint): string {
  const digits = scaled.toString().padStart(RATE_SCALE + 1, "0");
  const intPart = digits.slice(0, -RATE_SCALE);
  const fracPart = digits.slice(-RATE_SCALE);
  return `${intPart}.${fracPart}`;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * `amountMinor` (in a currency of exponent `expSource`) converted to the
 * equivalent minor-unit amount in a currency of exponent `expTarget`, at
 * `rateScaled` (quote-per-base, scaled by `10^RATE_SCALE`) — currency.md
 * § The conversion arithmetic:
 *
 * ```
 * converted = amount × rate × 10^(expTarget − expSource)
 * ```
 *
 * computed as one `bigint` fraction and rounded **half-up** (every amount
 * here is positive, so there's no negative-rounding direction to pick).
 * The `10^(expTarget − expSource)` factor is folded into the numerator
 * when the exponent difference is non-negative and into the denominator
 * when it's negative — `10n ** BigInt(negative)` isn't representable, and
 * the two currencies swapping which one has more minor-unit digits is
 * exactly the case a same-exponent shortcut would get wrong the moment a
 * zero-exponent currency (JPY, CLP) shows up on either side.
 *
 * The rounding addend is always `denominator / 2n`: `denominator` is
 * `10^RATE_SCALE` times an optional extra power of ten, so it's always
 * even, and `floor((n + d/2) / d)` is the standard integer form of
 * round-half-up for a positive fraction `n/d`.
 */
export function convertMinorUnits(
  amountMinor: bigint,
  rateScaled: bigint,
  expSource: number,
  expTarget: number,
): bigint {
  const exponentDiff = expTarget - expSource;
  let numerator = amountMinor * rateScaled;
  let denominator = RATE_SCALE_FACTOR;
  if (exponentDiff >= 0) numerator *= pow10(exponentDiff);
  else denominator *= pow10(-exponentDiff);

  return (numerator + denominator / 2n) / denominator;
}

/**
 * Derives a cross rate at the scaled-integer level — `COP→EUR =
 * (USD→EUR) / (USD→COP)` (currency.md), generalized to any shared base:
 * `deriveCrossRateScaled(usdToEur, usdToCop)`. Both inputs and the result
 * are `10^RATE_SCALE`-scaled integers, so dividing them directly would
 * lose the scale (it'd return an unscaled ratio); multiplying the
 * numerator by `RATE_SCALE_FACTOR` first restores it:
 *
 * ```
 * crossScaled = (numeratorScaled × 10^RATE_SCALE) / denominatorScaled
 * ```
 *
 * **The documented rounding point**: half-up, via the same `+
 * denominator/2` integer trick as `convertMinorUnits` — but here
 * `denominator` is an arbitrary fetched rate, not a guaranteed-even power
 * of ten, so `denominator / 2n` can itself floor when the rate happens to
 * be scaled to an odd integer. That's the same standard round-half-up
 * formula regardless of parity (a numerator can never land exactly on a
 * `.5` of an odd denominator when both are integers), it just means the
 * "exactly half" case this function is documented to round up from
 * literally cannot occur when the denominator is odd.
 */
export function deriveCrossRateScaled(numeratorScaled: bigint, denominatorScaled: bigint): bigint {
  const numerator = numeratorScaled * RATE_SCALE_FACTOR;
  return (numerator + denominatorScaled / 2n) / denominatorScaled;
}
