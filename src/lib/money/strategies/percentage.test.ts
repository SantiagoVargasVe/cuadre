import { describe, expect, it } from "vitest";
import { PercentagesDoNotSumError } from "../errors";
import { resolvePercentageSplit } from "./percentage";

describe("resolvePercentageSplit", () => {
  it("splits 60/40 on 100.00 USD (10000n) with no remainder", () => {
    const basisPoints = new Map([
      ["ana", 6000n],
      ["beto", 4000n],
    ]);
    expect(resolvePercentageSplit(basisPoints, 10000n, "seed")).toEqual(
      new Map([
        ["ana", 6000n],
        ["beto", 4000n],
      ]),
    );
  });

  it("rejects basis points that don't sum to exactly 10000, naming the actual sum", () => {
    const basisPoints = new Map([
      ["ana", 5000n],
      ["beto", 4000n],
    ]);
    const error = (() => {
      try {
        resolvePercentageSplit(basisPoints, 10000n, "seed");
      } catch (caught) {
        return caught as PercentagesDoNotSumError;
      }
      throw new Error("expected a throw");
    })();
    expect(error).toBeInstanceOf(PercentagesDoNotSumError);
    expect(error.sum).toBe(9000n);
  });

  it("rejects a sum over 10000 the same way", () => {
    const basisPoints = new Map([
      ["ana", 6000n],
      ["beto", 6000n],
    ]);
    expect(() => resolvePercentageSplit(basisPoints, 10000n, "seed")).toThrow(
      PercentagesDoNotSumError,
    );
  });

  it("apportions any remainder by the same largest-remainder rule", () => {
    const basisPoints = new Map([
      ["ana", 3334n],
      ["beto", 3333n],
      ["caro", 3333n],
    ]);
    const result = resolvePercentageSplit(basisPoints, 100n, "seed");
    expect([...result.values()].reduce((a, b) => a + b, 0n)).toBe(100n);
  });
});
