import { describe, expect, it } from "vitest";
import { UnknownCurrencyError } from "./errors";
import { formatAmountInput, formatMoney, parseAmountInput } from "./format";

/** Intl's `es-CO` currency literal between the symbol and the number is a
 * non-breaking space (U+00A0), not U+0020 — asserted here so a plain
 * space typed into an expectation doesn't quietly fail Object.is. */
const NBSP = " ";

describe("formatMoney", () => {
  it("renders COP with no decimals, grouped", () => {
    expect(formatMoney({ amount: 15000000n, currency: "COP" })).toBe(`$${NBSP}150.000`);
  });

  it("renders USD with two decimals", () => {
    expect(formatMoney({ amount: 8645n, currency: "USD" })).toBe(`$${NBSP}86,45`);
  });

  it("renders EUR with the € symbol, not the literal code 'EUR'", () => {
    const result = formatMoney({ amount: 4500n, currency: "EUR" });
    expect(result).toBe(`€${NBSP}45,00`);
    expect(result).not.toContain("EUR");
  });

  it("drops a COP fractional remainder rather than rounding it in", () => {
    // 150000.34 COP — the .34 only exists from a currency conversion; the
    // UI never shows centavos (splitting.md § 1).
    expect(formatMoney({ amount: 15000034n, currency: "COP" })).toBe(`$${NBSP}150.000`);
  });

  it("does not lose precision for a COP amount past Number.MAX_SAFE_INTEGER", () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) * 1000n + 12300n;
    const result = formatMoney({ amount: huge, currency: "COP" });
    // Exact expected grouping of (huge / 100n) with '.' thousands separators.
    const expectedDigits = (huge / 100n).toString();
    const grouped = expectedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    expect(result).toBe(`$${NBSP}${grouped}`);
  });

  describe("signed", () => {
    it("prefixes a positive amount with +", () => {
      expect(formatMoney({ amount: 2000000n, currency: "COP" }, { signed: true })).toBe(
        `+$${NBSP}20.000`,
      );
    });

    it("prefixes a negative amount with − regardless of signed", () => {
      expect(formatMoney({ amount: -2000000n, currency: "COP" })).toBe(`-$${NBSP}20.000`);
      expect(formatMoney({ amount: -2000000n, currency: "COP" }, { signed: true })).toBe(
        `-$${NBSP}20.000`,
      );
    });

    it("shows no sign for exactly zero even when signed", () => {
      expect(formatMoney({ amount: 0n, currency: "COP" }, { signed: true })).toBe(`$${NBSP}0`);
    });

    it("signs a negative amount whose major part truncates to zero", () => {
      // -50n at exponent 2 is -0.50 — majorPart is 0n, which carries no
      // sign of its own (bigint division truncates toward zero). The
      // minus must come from the original amount, not from formatting 0n.
      expect(formatMoney({ amount: -50n, currency: "USD" })).toBe(`-$${NBSP}0,50`);
    });
  });

  it("throws UnknownCurrencyError for a currency with no display metadata", () => {
    expect(() => formatMoney({ amount: 100n, currency: "JPY" })).toThrow(UnknownCurrencyError);
  });
});

describe("formatAmountInput", () => {
  it("groups a COP integer into thousands as it grows, digit by digit", () => {
    expect(formatAmountInput("1", "COP")).toBe("1");
    expect(formatAmountInput("15", "COP")).toBe("15");
    expect(formatAmountInput("150", "COP")).toBe("150");
    expect(formatAmountInput("1500", "COP")).toBe("1.500");
    expect(formatAmountInput("15000", "COP")).toBe("15.000");
    expect(formatAmountInput("150000", "COP")).toBe("150.000");
  });

  it("never introduces a decimal separator for COP (displayDecimals: 0)", () => {
    expect(formatAmountInput("150000,50", "COP")).toBe("150.000");
  });

  it("keeps a trailing decimal separator so the user can keep typing a fraction", () => {
    expect(formatAmountInput("86,", "USD")).toBe("86,");
    expect(formatAmountInput("86,4", "USD")).toBe("86,4");
    expect(formatAmountInput("86,45", "USD")).toBe("86,45");
  });

  it("caps fraction digits at the currency's displayDecimals", () => {
    expect(formatAmountInput("86,456", "USD")).toBe("86,45");
  });

  it("re-derives grouping from an already-grouped value (backspace, paste)", () => {
    // Deleting a character from "150.000" re-enters this function as
    // "150.00" (backspace) — must not treat the "." as a literal digit.
    expect(formatAmountInput("150.00", "COP")).toBe("15.000");
    // Pasting a fully-formatted amount must round-trip unchanged.
    expect(formatAmountInput("1.234.567", "COP")).toBe("1.234.567");
  });

  it("drops non-digit characters instead of rejecting them", () => {
    expect(formatAmountInput("15a0b00", "COP")).toBe("15.000");
  });

  it("returns an empty string for empty input", () => {
    expect(formatAmountInput("", "COP")).toBe("");
  });
});

describe("parseAmountInput", () => {
  it("parses a grouped COP amount to its exact minor-unit bigint", () => {
    expect(parseAmountInput("150.000", "COP")).toBe(15000000n);
  });

  it("parses a USD amount with cents", () => {
    expect(parseAmountInput("86,45", "USD")).toBe(8645n);
  });

  it("pads a partially-typed fraction with zeros", () => {
    expect(parseAmountInput("86,4", "USD")).toBe(8640n);
  });

  it("treats a missing fraction as .00", () => {
    expect(parseAmountInput("86", "USD")).toBe(8600n);
  });

  it("treats empty input as zero", () => {
    expect(parseAmountInput("", "USD")).toBe(0n);
  });

  it("round-trips formatAmountInput's output back to the original minor units", () => {
    const original = { amount: 15000000n, currency: "COP" };
    const typed = formatAmountInput("150000", original.currency);
    expect(parseAmountInput(typed, original.currency)).toBe(original.amount);
  });
});
