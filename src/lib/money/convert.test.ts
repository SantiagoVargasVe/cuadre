import { describe, expect, it } from "vitest";
import { InvalidRateError } from "./errors";
import { convertMinorUnits, deriveCrossRateScaled, formatRateScaled, parseRateScaled } from "./convert";

describe("parseRateScaled", () => {
  it("matches currency.md's own worked rate exactly", () => {
    expect(parseRateScaled("3042.806266")).toBe(30428062660000n);
  });

  it("parses a rate string with trailing zeros identically to one without", () => {
    expect(parseRateScaled("3042.8062660000")).toBe(parseRateScaled("3042.806266"));
  });

  it("parses an integer rate with no decimal point", () => {
    expect(parseRateScaled("5")).toBe(50000000000n);
  });

  it("parses a rate with the full 10 fractional digits", () => {
    expect(parseRateScaled("1.2345678901")).toBe(12345678901n);
  });

  it.each([
    ["a negative sign", "-1.5"],
    ["scientific notation", "1e9"],
    ["more than 10 fractional digits", "1.12345678901"],
    ["a stray letter", "1.5x"],
    ["the empty string", ""],
  ])("rejects %s", (_label, input) => {
    expect(() => parseRateScaled(input)).toThrow(InvalidRateError);
  });
});

describe("convertMinorUnits", () => {
  it("matches currency.md's worked example: 20.00 USD at USD→COP 3042.806266 is exactly $60.856,13 COP", () => {
    const rateScaled = parseRateScaled("3042.806266");
    expect(convertMinorUnits(2000n, rateScaled, 2, 2)).toBe(6085613n);
  });

  it("rounds exactly on the half-up boundary, not toward zero", () => {
    // 1 minor unit at a 1.5 rate is 1.5 minor units in the target currency
    // — precisely the rounding boundary (numerator/denominator == 1.5).
    // Half-up means this rounds to 2, not 1.
    const rateScaled = 15000000000n; // 1.5
    expect(convertMinorUnits(1n, rateScaled, 0, 0)).toBe(2n);
  });

  it("converts correctly when the target currency has fewer minor-unit digits (exp2 -> exp0)", () => {
    const rateScaled = parseRateScaled("1.0");
    // 100 minor units at exponent 2 is 1.00 whole unit; at a 1:1 rate that's
    // 1 whole unit, which is 1 minor unit for an exponent-0 currency.
    expect(convertMinorUnits(100n, rateScaled, 2, 0)).toBe(1n);
  });

  it("converts correctly when the target currency has more minor-unit digits (exp0 -> exp2)", () => {
    const rateScaled = parseRateScaled("1.0");
    // 1 minor unit at exponent 0 is 1 whole unit; at a 1:1 rate that's 100
    // minor units for an exponent-2 currency.
    expect(convertMinorUnits(1n, rateScaled, 0, 2)).toBe(100n);
  });

  it("handles a huge amount without precision loss", () => {
    const rateScaled = parseRateScaled("3042.806266");
    const huge = 9_007_199_254_740_993n; // one past Number.MAX_SAFE_INTEGER
    const result = convertMinorUnits(huge, rateScaled, 2, 2);
    // Verified independently: floor((huge * rateScaled + 5e9) / 1e10).
    expect(result).toBe((huge * rateScaled + 5_000_000_000n) / 10_000_000_000n);
  });
});

describe("deriveCrossRateScaled", () => {
  it("derives COP→EUR from USD→EUR and USD→COP, consistent with a direct USD round-trip within rounding", () => {
    const usdToEur = parseRateScaled("0.857211");
    const usdToCop = parseRateScaled("3042.806266");
    const copToEur = deriveCrossRateScaled(usdToEur, usdToCop);

    // 1,000,000.00 COP converted directly at the derived cross rate...
    const direct = convertMinorUnits(100_000_000n, copToEur, 2, 2);
    // ...should land within a cent of the same amount converted COP->USD->EUR.
    const viaUsd = (100_000_000n * 10_000_000_000n) / usdToCop; // COP minor units -> USD minor units (unrounded, for comparison)
    const viaUsdToEur = convertMinorUnits(viaUsd, usdToEur, 2, 2);
    expect(direct - viaUsdToEur >= -1n && direct - viaUsdToEur <= 1n).toBe(true);
  });

  it("round-trips: deriving A→B then B→A returns approximately the original rate", () => {
    const aToB = parseRateScaled("2.5");
    const bToA = deriveCrossRateScaled(parseRateScaled("1.0"), aToB);
    // 1 / 2.5 = 0.4 exactly.
    expect(bToA).toBe(4000000000n);
  });
});

describe("formatRateScaled", () => {
  it("is the exact inverse of parseRateScaled for a typical rate", () => {
    const scaled = parseRateScaled("3042.806266");
    expect(formatRateScaled(scaled)).toBe("3042.8062660000");
    expect(parseRateScaled(formatRateScaled(scaled))).toBe(scaled);
  });

  it("formats a rate smaller than 1 without dropping leading zeros", () => {
    expect(formatRateScaled(parseRateScaled("0.0002817172"))).toBe("0.0002817172");
  });

  it("formats a whole-number rate with an explicit .0000000000", () => {
    expect(formatRateScaled(parseRateScaled("5"))).toBe("5.0000000000");
  });

  it("formats a scaled value smaller than the scale factor itself", () => {
    expect(formatRateScaled(5n)).toBe("0.0000000005");
  });
});
