import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, InvalidAmountError, NonPositiveAmountError } from "./errors";
import { add, assertPositive, compare, equals, parseMinorUnits } from "./parse";

describe("parseMinorUnits", () => {
  it.each([
    ["scientific notation", "1e9"],
    ["surrounding whitespace", " 12 "],
    ["a decimal point", "12.5"],
    ["a negative sign", "-5"],
    ["the empty string", ""],
    ["a plus sign", "+5"],
    ["a thousands separator", "1,000"],
    ["non-numeric garbage", "abc"],
  ])("rejects %s (%s)", (_label, input) => {
    expect(() => parseMinorUnits(input)).toThrow(InvalidAmountError);
  });

  it("parses a plain digit string to a bigint", () => {
    expect(parseMinorUnits("15000000")).toBe(15000000n);
  });

  it("parses zero", () => {
    expect(parseMinorUnits("0")).toBe(0n);
  });

  it("survives a COP amount past Number.MAX_SAFE_INTEGER intact", () => {
    const huge = (BigInt(Number.MAX_SAFE_INTEGER) + 1000n).toString();
    expect(parseMinorUnits(huge)).toBe(BigInt(Number.MAX_SAFE_INTEGER) + 1000n);
  });

  it("names the rejected input on the thrown error", () => {
    const error = (() => {
      try {
        parseMinorUnits("12.5");
      } catch (caught) {
        return caught as InvalidAmountError;
      }
      throw new Error("expected a throw");
    })();
    expect(error.input).toBe("12.5");
  });
});

describe("assertPositive", () => {
  it("passes for a positive amount", () => {
    expect(() => assertPositive(1n)).not.toThrow();
  });

  it("rejects zero", () => {
    expect(() => assertPositive(0n)).toThrow(NonPositiveAmountError);
  });

  it("rejects a negative amount", () => {
    expect(() => assertPositive(-1n)).toThrow(NonPositiveAmountError);
  });
});

describe("add", () => {
  it("sums two Money values of the same currency", () => {
    expect(add({ amount: 100n, currency: "COP" }, { amount: 200n, currency: "COP" })).toEqual({
      amount: 300n,
      currency: "COP",
    });
  });

  it("throws CurrencyMismatchError for different currencies", () => {
    expect(() => add({ amount: 100n, currency: "COP" }, { amount: 200n, currency: "USD" })).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe("compare / equals", () => {
  it("orders by amount within the same currency", () => {
    const a = { amount: 100n, currency: "COP" };
    const b = { amount: 200n, currency: "COP" };
    expect(compare(a, b)).toBe(-1);
    expect(compare(b, a)).toBe(1);
    expect(compare(a, a)).toBe(0);
  });

  it("equals is true only for the same amount and currency", () => {
    expect(equals({ amount: 100n, currency: "COP" }, { amount: 100n, currency: "COP" })).toBe(true);
    expect(equals({ amount: 100n, currency: "COP" }, { amount: 101n, currency: "COP" })).toBe(false);
  });

  it("throws CurrencyMismatchError comparing different currencies", () => {
    const a = { amount: 100n, currency: "COP" };
    const b = { amount: 100n, currency: "USD" };
    expect(() => compare(a, b)).toThrow(CurrencyMismatchError);
    expect(() => equals(a, b)).toThrow(CurrencyMismatchError);
  });
});
