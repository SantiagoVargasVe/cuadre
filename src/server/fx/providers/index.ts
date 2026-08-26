import "server-only";
import { config } from "../../config";
import { openErApiProvider } from "./open-er-api";
import type { RateProvider } from "./types";

export type { ProviderRates, RateProvider } from "./types";
export {
  InvalidProviderResponseError,
  MissingCurrencyError,
  ProviderRequestFailedError,
  ProviderReturnedErrorError,
  TrmRateNotFoundError,
} from "./errors";
export { checkTrmDivergence, fetchTrmRate, TRM_SOURCE, type TrmRate } from "./trm";

/**
 * `FX_PROVIDER` picks the primary rate source (currently only one option,
 * but the switch is here so adding a second never touches a call site —
 * currency.md § Choosing a provider).
 */
export function getRateProvider(): RateProvider {
  switch (config.FX_PROVIDER) {
    case "open-er-api":
      return openErApiProvider;
  }
}
