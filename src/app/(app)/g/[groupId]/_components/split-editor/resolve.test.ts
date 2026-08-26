import { describe, expect, it } from "vitest";
import { resolveEqualSplit } from "../../../../../../lib/money/strategies/equal";
import {
  ExactAmountsDoNotBalanceError,
  PercentagesDoNotSumError,
  equalDefault,
  resolveSplitPreview,
} from "./resolve";

const members = ["ana", "beto", "caro"];

describe("resolveSplitPreview", () => {
  it("is byte-identical to the server's own resolveEqualSplit for `equal`", () => {
    const seed = "expense-1";
    const viaShared = resolveEqualSplit(members, 10000000n, seed);
    const viaPreview = resolveSplitPreview({ strategy: "equal" }, members, 10000000n, seed);
    expect(viaPreview).toEqual(viaShared);
  });

  it("resolves `equal_subset` over only the given members", () => {
    const result = resolveSplitPreview(
      { strategy: "equal_subset", members: ["ana", "beto"] },
      members,
      10000000n,
      "seed",
    );
    expect([...result.keys()].sort()).toEqual(["ana", "beto"]);
    expect([...result.values()].reduce((sum, v) => sum + v, 0n)).toBe(10000000n);
  });

  it("resolves `shares` proportionally to the weights", () => {
    const result = resolveSplitPreview(
      { strategy: "shares", weights: { ana: 2, beto: 1 } },
      members,
      9000000n,
      "seed",
    );
    expect(result.get("ana")).toBe(6000000n);
    expect(result.get("beto")).toBe(3000000n);
  });

  it("resolves `percentage` from basis points", () => {
    const result = resolveSplitPreview(
      { strategy: "percentage", basisPoints: { ana: 6000, beto: 4000 } },
      members,
      10000n,
      "seed",
    );
    expect(result.get("ana")).toBe(6000n);
    expect(result.get("beto")).toBe(4000n);
  });

  it("throws PercentagesDoNotSumError when basis points don't sum to 10000", () => {
    expect(() =>
      resolveSplitPreview({ strategy: "percentage", basisPoints: { ana: 5000 } }, members, 10000n, "seed"),
    ).toThrow(PercentagesDoNotSumError);
  });

  it("resolves `exact` to precisely the amounts given", () => {
    const result = resolveSplitPreview(
      { strategy: "exact", amounts: { ana: "4200", beto: "5800" } },
      members,
      10000n,
      "seed",
    );
    expect(result).toEqual(new Map([["ana", 4200n], ["beto", 5800n]]));
  });

  it("names the exact difference when exact amounts fall short", () => {
    try {
      resolveSplitPreview({ strategy: "exact", amounts: { ana: "4000" } }, members, 10000n, "seed");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ExactAmountsDoNotBalanceError);
      expect((error as ExactAmountsDoNotBalanceError).difference).toBe(6000n);
    }
  });

  it("resolves `loan` to the full amount for the beneficiary alone", () => {
    const result = resolveSplitPreview({ strategy: "loan", to: "beto" }, members, 5000n, "seed");
    expect(result).toEqual(new Map([["beto", 5000n]]));
  });
});

describe("equalDefault", () => {
  it("matches the documented three-way 100.000 example", () => {
    // splitting.md § 3.2's worked example is seed-specific (it picks
    // offset 1 for this particular expense id); asserting the *shape* —
    // sums to the total, one member absorbs the leftover peso — is what's
    // actually invariant here.
    const result = equalDefault(10000000n, members, "any-seed");
    const values = [...result.values()];
    expect(values.reduce((sum, v) => sum + v, 0n)).toBe(10000000n);
    expect(values.filter((v) => v === 3333334n)).toHaveLength(1);
    expect(values.filter((v) => v === 3333333n)).toHaveLength(2);
  });
});
