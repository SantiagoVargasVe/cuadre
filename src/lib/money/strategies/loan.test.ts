import { describe, expect, it } from "vitest";
import { NonPositiveAmountError } from "../errors";
import { resolveLoanSplit } from "./loan";

describe("resolveLoanSplit", () => {
  it("puts the whole total on the one beneficiary", () => {
    expect(resolveLoanSplit("beto", 15000n)).toEqual(new Map([["beto", 15000n]]));
  });

  it("rejects a non-positive total", () => {
    expect(() => resolveLoanSplit("beto", 0n)).toThrow(NonPositiveAmountError);
  });
});
