/**
 * Plain `Error` subclasses, not `DomainError` (server/errors.ts) — this
 * module imports nothing (see types.ts), and services translate these into
 * the right HTTP status at the point they call in.
 */

export class InvalidAmountError extends Error {
  readonly input: string;
  constructor(input: string) {
    super(`"${input}" is not a valid minor-unit amount`);
    this.name = "InvalidAmountError";
    this.input = input;
  }
}

export class NonPositiveAmountError extends Error {
  readonly amount: bigint;
  constructor(amount: bigint) {
    super(`Amount must be strictly positive, got ${amount}`);
    this.name = "NonPositiveAmountError";
    this.amount = amount;
  }
}

export class CurrencyMismatchError extends Error {
  readonly left: string;
  readonly right: string;
  constructor(left: string, right: string) {
    super(`Cannot operate on different currencies: ${left} and ${right}`);
    this.name = "CurrencyMismatchError";
    this.left = left;
    this.right = right;
  }
}

/** apportion() needs at least one member to divide the total among. */
export class EmptyApportionmentError extends Error {
  constructor() {
    super("Cannot apportion among zero members");
    this.name = "EmptyApportionmentError";
  }
}

/** A member with a zero (or negative) share shouldn't be in the split at all. */
export class NonPositiveWeightError extends Error {
  readonly id: string;
  readonly weight: bigint;
  constructor(id: string, weight: bigint) {
    super(`Weight for "${id}" must be strictly positive, got ${weight}`);
    this.name = "NonPositiveWeightError";
    this.id = id;
    this.weight = weight;
  }
}

/** `percentage`'s basis points must sum to exactly 10000 — never "about 100%". */
export class PercentagesDoNotSumError extends Error {
  readonly sum: bigint;
  constructor(sum: bigint) {
    super(`Basis points must sum to exactly 10000, got ${sum}`);
    this.name = "PercentagesDoNotSumError";
    this.sum = sum;
  }
}

/**
 * `exact`'s caller-supplied amounts didn't sum to the total. Never adjusted
 * to fit — `expected`/`actual`/`difference` are structured because the
 * split editor renders `difference` live (splitting.md §3).
 */
export class ExactAmountsDoNotBalanceError extends Error {
  readonly expected: bigint;
  readonly actual: bigint;
  readonly difference: bigint;
  constructor(expected: bigint, actual: bigint) {
    super(`Exact amounts sum to ${actual}, expected ${expected}`);
    this.name = "ExactAmountsDoNotBalanceError";
    this.expected = expected;
    this.actual = actual;
    this.difference = expected - actual;
  }
}
