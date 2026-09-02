import { describe, expect, it } from "vitest";
import { deriveStrategyDefaults } from "./deriveStrategyDefaults";
import type { SplitEditorState } from "./types";

const baseState: SplitEditorState = {
  strategy: "equal",
  equalStrategy: "equal",
  equalMembersExplicit: false,
  selectedIds: ["ana", "beto", "caro"],
  weights: {},
  basisPoints: {},
  exactAmounts: {},
  loanBeneficiary: null,
};

describe("deriveStrategyDefaults", () => {
  it("keeps the member selection when switching strategies", () => {
    const next = deriveStrategyDefaults("shares", baseState, 10000000n, "seed");
    expect(next.selectedIds).toEqual(baseState.selectedIds);
  });

  it("defaults every selected member to 1 share, without touching an existing weight", () => {
    const next = deriveStrategyDefaults(
      "shares",
      { ...baseState, weights: { ana: 5 } },
      10000000n,
      "seed",
    );
    expect(next.weights).toEqual({ ana: 5, beto: 1, caro: 1 });
  });

  it("derives basis points that sum to exactly 10000 across the selection", () => {
    const next = deriveStrategyDefaults("percentage", baseState, 10000000n, "seed");
    const sum = Object.values(next.basisPoints).reduce((total, bp) => total + bp, 0);
    expect(sum).toBe(10000);
    expect(Object.keys(next.basisPoints).sort()).toEqual(["ana", "beto", "caro"]);
  });

  it("derives exact amounts that sum to exactly the total across the selection", () => {
    const next = deriveStrategyDefaults("exact", baseState, 10000000n, "seed");
    const sum = Object.values(next.exactAmounts).reduce((total, amount) => total + BigInt(amount), 0n);
    expect(sum).toBe(10000000n);
  });

  it("keeps an existing loan beneficiary if they're still selected", () => {
    const next = deriveStrategyDefaults("loan", { ...baseState, loanBeneficiary: "beto" }, 10000000n, "seed");
    expect(next.loanBeneficiary).toBe("beto");
  });

  it("falls back to the first selected member when the prior beneficiary is no longer selected", () => {
    const next = deriveStrategyDefaults(
      "loan",
      { ...baseState, selectedIds: ["ana", "caro"], loanBeneficiary: "beto" },
      10000000n,
      "seed",
    );
    expect(next.loanBeneficiary).toBe("ana");
  });

  it("leaves percentage/exact untouched when the total isn't positive yet", () => {
    const next = deriveStrategyDefaults("percentage", baseState, 0n, "seed");
    expect(next.basisPoints).toEqual({});
  });
});
