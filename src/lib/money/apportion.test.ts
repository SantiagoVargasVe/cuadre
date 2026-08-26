import { describe, expect, it } from "vitest";
import { apportion } from "./apportion";
import {
  EmptyApportionmentError,
  NonPositiveAmountError,
  NonPositiveWeightError,
} from "./errors";

function sum(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

describe("apportion", () => {
  it("splits the splitting.md §3.2 worked example exactly: 10,000,000 COP three ways", () => {
    const weights = new Map([
      ["ana", 1n],
      ["beto", 1n],
      ["caro", 1n],
    ]);

    // These three seeds were chosen (see PR description) to exercise
    // offset 0, 1, and 2 for n=3 respectively — the leftover peso lands
    // on a different member each time, purely from the seed changing.
    expect(apportion(10000000n, weights, "expense-3")).toEqual(
      new Map([
        ["ana", 3333334n],
        ["beto", 3333333n],
        ["caro", 3333333n],
      ]),
    );
    expect(apportion(10000000n, weights, "expense-1")).toEqual(
      new Map([
        ["ana", 3333333n],
        ["beto", 3333334n],
        ["caro", 3333333n],
      ]),
    );
    expect(apportion(10000000n, weights, "expense-2")).toEqual(
      new Map([
        ["ana", 3333333n],
        ["beto", 3333333n],
        ["caro", 3333334n],
      ]),
    );
  });

  it("splits 60/40 percentage-style weights on 10000 USD cents with zero remainder", () => {
    const weights = new Map([
      ["ana", 6000n],
      ["beto", 4000n],
    ]);
    expect(apportion(10000n, weights, "any-seed")).toEqual(
      new Map([
        ["ana", 6000n],
        ["beto", 4000n],
      ]),
    );
  });

  it("sums to the total exactly across many (total, weights) combinations", () => {
    const cases: Array<[bigint, [string, bigint][]]> = [
      [7n, [["a", 1n], ["b", 1n], ["c", 1n]]],
      [1n, [["a", 1n], ["b", 1n], ["c", 1n]]],
      [100n, [["a", 3n], ["b", 5n], ["c", 7n]]],
      [999999999999999999n, [["a", 1n], ["b", 1n]]],
      [10n, [["a", 1n]]],
      [1000000000000000000n, [["a", 1n], ["b", 2n], ["c", 3n], ["d", 4n], ["e", 5n]]],
    ];

    for (const [total, weightPairs] of cases) {
      const result = apportion(total, new Map(weightPairs), `seed-${total}`);
      expect(sum(result.values())).toBe(total);
    }
  });

  it("gives every member at least their floored base share", () => {
    const weights = new Map([
      ["a", 1n],
      ["b", 1n],
      ["c", 5n],
    ]);
    const result = apportion(100n, weights, "seed");
    // base: a=14, b=14, c=71 (140/7=20... recompute: total*w/W)
    expect(result.get("a")!).toBeGreaterThanOrEqual(100n * 1n / 7n);
    expect(result.get("b")!).toBeGreaterThanOrEqual(100n * 1n / 7n);
    expect(result.get("c")!).toBeGreaterThanOrEqual((100n * 5n) / 7n);
  });

  it("is deterministic: the same (total, weights, seed) always produces the same output", () => {
    const weights = new Map([
      ["ana", 1n],
      ["beto", 3n],
      ["caro", 2n],
    ]);
    const first = apportion(1000001n, weights, "expense-42");
    for (let i = 0; i < 10; i++) {
      expect(apportion(1000001n, weights, "expense-42")).toEqual(first);
    }
  });

  it("rejects an empty weights map", () => {
    expect(() => apportion(100n, new Map(), "seed")).toThrow(EmptyApportionmentError);
  });

  it("rejects a zero weight, naming the member", () => {
    const weights = new Map([
      ["ana", 1n],
      ["beto", 0n],
    ]);
    const error = (() => {
      try {
        apportion(100n, weights, "seed");
      } catch (caught) {
        return caught as NonPositiveWeightError;
      }
      throw new Error("expected a throw");
    })();
    expect(error).toBeInstanceOf(NonPositiveWeightError);
    expect(error.id).toBe("beto");
  });

  it("rejects a negative weight", () => {
    const weights = new Map([["ana", -1n]]);
    expect(() => apportion(100n, weights, "seed")).toThrow(NonPositiveWeightError);
  });

  it("rejects a non-positive total", () => {
    const weights = new Map([["ana", 1n]]);
    expect(() => apportion(0n, weights, "seed")).toThrow(NonPositiveAmountError);
    expect(() => apportion(-5n, weights, "seed")).toThrow(NonPositiveAmountError);
  });

  it("handles a single member by giving them the whole total", () => {
    expect(apportion(12345n, new Map([["solo", 1n]]), "seed")).toEqual(new Map([["solo", 12345n]]));
  });

  it("handles a total smaller than the member count without losing or duplicating units", () => {
    const weights = new Map([
      ["a", 1n],
      ["b", 1n],
      ["c", 1n],
      ["d", 1n],
      ["e", 1n],
    ]);
    const result = apportion(2n, weights, "seed");
    expect(sum(result.values())).toBe(2n);
    const nonZero = [...result.values()].filter((v) => v > 0n);
    expect(nonZero).toHaveLength(2);
    expect(nonZero.every((v) => v === 1n)).toBe(true);
  });

  it("stays exact for weights and totals well past Number.MAX_SAFE_INTEGER", () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) * 1000n + 7n;
    const weights = new Map([
      ["a", BigInt(Number.MAX_SAFE_INTEGER)],
      ["b", 1n],
    ]);
    const result = apportion(huge, weights, "seed");
    expect(sum(result.values())).toBe(huge);
  });
});
