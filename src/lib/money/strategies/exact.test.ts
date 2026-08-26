import { describe, expect, it } from "vitest";
import { ExactAmountsDoNotBalanceError, NonPositiveWeightError } from "../errors";
import { resolveExactSplit } from "./exact";

describe("resolveExactSplit", () => {
  it("returns the caller-supplied amounts unchanged when they sum to the total", () => {
    const amounts = new Map([
      ["ana", 4200n],
      ["beto", 5800n],
    ]);
    expect(resolveExactSplit(amounts, 10000n)).toEqual(amounts);
  });

  it("rejects a sum that doesn't match the total, with expected/actual/difference", () => {
    const amounts = new Map([
      ["ana", 4000n],
      ["beto", 5800n],
    ]);
    const error = (() => {
      try {
        resolveExactSplit(amounts, 10000n);
      } catch (caught) {
        return caught as ExactAmountsDoNotBalanceError;
      }
      throw new Error("expected a throw");
    })();
    expect(error).toBeInstanceOf(ExactAmountsDoNotBalanceError);
    expect(error.expected).toBe(10000n);
    expect(error.actual).toBe(9800n);
    expect(error.difference).toBe(200n);
  });

  it("never adjusts the amounts to fit — it only ever throws or passes them through", () => {
    const amounts = new Map([["ana", 9999n]]);
    expect(() => resolveExactSplit(amounts, 10000n)).toThrow(ExactAmountsDoNotBalanceError);
  });

  it("rejects a zero or negative amount", () => {
    expect(() => resolveExactSplit(new Map([["ana", 0n]]), 0n)).toThrow(NonPositiveWeightError);
    expect(() => resolveExactSplit(new Map([["ana", -1n]]), -1n)).toThrow(NonPositiveWeightError);
  });
});
