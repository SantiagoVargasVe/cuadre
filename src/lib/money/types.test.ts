import { describe, expect, it } from "vitest";
import { CurrencyMismatchError } from "./errors";
import { assertSameCurrency } from "./types";

describe("assertSameCurrency", () => {
  it("passes for two Money values in the same currency", () => {
    expect(() =>
      assertSameCurrency({ amount: 1n, currency: "COP" }, { amount: 2n, currency: "COP" }),
    ).not.toThrow();
  });

  it("throws CurrencyMismatchError, naming both currencies, for a mismatch", () => {
    const error = (() => {
      try {
        assertSameCurrency({ amount: 1n, currency: "COP" }, { amount: 2n, currency: "USD" });
      } catch (caught) {
        return caught as CurrencyMismatchError;
      }
      throw new Error("expected a throw");
    })();

    expect(error).toBeInstanceOf(CurrencyMismatchError);
    expect(error.left).toBe("COP");
    expect(error.right).toBe("USD");
  });
});
