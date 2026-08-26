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
