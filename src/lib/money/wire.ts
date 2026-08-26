import { parseMinorUnits } from "./parse";
import type { CurrencyCode, Money } from "./types";

/** The shape money takes crossing the wire (api-contract.md): a string, never a JSON number. */
export interface WireMoney {
  amount: string;
  currency: CurrencyCode;
}

/** COP minor units pass Number.MAX_SAFE_INTEGER sooner than feels comfortable — never a number here. */
export function toWire(money: Money): WireMoney {
  return { amount: money.amount.toString(), currency: money.currency };
}

/** The inverse of toWire. Throws InvalidAmountError via parseMinorUnits for a malformed amount. */
export function fromWire(wire: WireMoney): Money {
  return { amount: parseMinorUnits(wire.amount), currency: wire.currency };
}
