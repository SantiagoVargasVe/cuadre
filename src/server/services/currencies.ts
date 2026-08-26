import "server-only";
import { config } from "../config";
import { ValidationError } from "../errors";

/** Not one of the currencies this app is configured to support (SUPPORTED_CURRENCIES). */
export class UnsupportedCurrencyError extends ValidationError {
  constructor(currency: string) {
    super("CURRENCY_NOT_SUPPORTED", `Currency ${currency} is not supported`, { currency });
    this.name = "UnsupportedCurrencyError";
  }
}

export function assertSupportedCurrency(code: string): void {
  if (!(config.SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
    throw new UnsupportedCurrencyError(code);
  }
}
