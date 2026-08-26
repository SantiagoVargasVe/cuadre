import { describe, expect, it } from "vitest";
import { NonPositiveWeightError } from "../errors";
import { resolveSharesSplit } from "./shares";

describe("resolveSharesSplit", () => {
  it("weights a couple as two shares against a single share", () => {
    const weights = new Map([
      ["ana", 2n],
      ["beto", 2n],
      ["caro", 1n],
    ]);
    const result = resolveSharesSplit(weights, 500n, "seed");
    expect([...result.values()].reduce((a, b) => a + b, 0n)).toBe(500n);
    expect(result.get("caro")!).toBeLessThan(result.get("ana")!);
  });

  it("rejects a share weight of zero", () => {
    const weights = new Map([
      ["ana", 1n],
      ["beto", 0n],
    ]);
    expect(() => resolveSharesSplit(weights, 100n, "seed")).toThrow(NonPositiveWeightError);
  });
});
