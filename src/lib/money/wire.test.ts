import { describe, expect, it } from "vitest";
import { InvalidAmountError } from "./errors";
import { fromWire, toWire } from "./wire";

describe("toWire", () => {
  it("renders amount as a string, never a number", () => {
    const wire = toWire({ amount: 15000000n, currency: "COP" });
    expect(wire).toEqual({ amount: "15000000", currency: "COP" });
    expect(typeof wire.amount).toBe("string");
  });

  it("keeps a COP amount past Number.MAX_SAFE_INTEGER exact as a string", () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) * 100n;
    const wire = toWire({ amount: huge, currency: "COP" });
    expect(wire.amount).toBe(huge.toString());
  });
});

describe("fromWire", () => {
  it("parses the wire amount back to a bigint", () => {
    expect(fromWire({ amount: "15000000", currency: "COP" })).toEqual({
      amount: 15000000n,
      currency: "COP",
    });
  });

  it("rejects a malformed wire amount the same way parseMinorUnits does", () => {
    expect(() => fromWire({ amount: "12.5", currency: "COP" })).toThrow(InvalidAmountError);
  });
});

describe("round trip", () => {
  it("toWire then fromWire returns the original Money, including past MAX_SAFE_INTEGER", () => {
    const amounts = [0n, 1n, 15000000n, BigInt(Number.MAX_SAFE_INTEGER) + 12345n];
    for (const amount of amounts) {
      const original = { amount, currency: "COP" };
      expect(fromWire(toWire(original))).toEqual(original);
    }
  });
});
