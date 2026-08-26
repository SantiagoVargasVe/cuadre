import { describe, expect, it } from "vitest";
import { resolveEqualSplit } from "./equal";

describe("resolveEqualSplit", () => {
  it("splits equally among every id given, summing to the total", () => {
    const result = resolveEqualSplit(["ana", "beto", "caro"], 10000000n, "expense-1");
    expect([...result.values()].reduce((a, b) => a + b, 0n)).toBe(10000000n);
    expect(result.get("beto")).toBe(3333334n);
  });

  it("serves equal_subset identically — it's the same function over fewer ids", () => {
    const result = resolveEqualSplit(["ana", "beto"], 100n, "seed");
    expect(result).toEqual(new Map([["ana", 50n], ["beto", 50n]]));
  });

  it("gives the sole member the whole total for a one-person subset", () => {
    expect(resolveEqualSplit(["ana"], 12345n, "seed")).toEqual(new Map([["ana", 12345n]]));
  });

  it("drops a member entirely rather than giving them a zero share", () => {
    const result = resolveEqualSplit(["a", "b", "c", "d", "e"], 2n, "seed");
    expect(result.size).toBe(2);
    expect([...result.values()].reduce((a, b) => a + b, 0n)).toBe(2n);
  });
});
