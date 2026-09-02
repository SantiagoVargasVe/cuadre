import { describe, expect, it } from "vitest";
import { buildSplitInput } from "./buildSplitInput";
import type { SplitEditorState } from "./types";

const allMembers = ["ana", "beto", "caro"];

function state(overrides: Partial<SplitEditorState> = {}): SplitEditorState {
  return {
    strategy: "equal",
    equalStrategy: "equal",
    equalMembersExplicit: false,
    selectedIds: allMembers,
    weights: {},
    basisPoints: {},
    exactAmounts: {},
    loanBeneficiary: null,
    ...overrides,
  };
}

describe("buildSplitInput", () => {
  it("produces plain `equal` when every member is selected", () => {
    expect(buildSplitInput(state(), allMembers)).toEqual({ strategy: "equal" });
  });

  it("produces `equal_subset` once fewer than every member is selected", () => {
    expect(buildSplitInput(state({
      selectedIds: ["ana", "beto"],
      equalStrategy: "equal_subset",
      equalMembersExplicit: true,
    }), allMembers)).toEqual({
      strategy: "equal_subset",
      members: ["ana", "beto"],
    });
  });

  it("filters shares weights down to selected members only", () => {
    const result = buildSplitInput(
      state({ strategy: "shares", selectedIds: ["ana"], weights: { ana: 2, beto: 1, caro: 1 } }),
      allMembers,
    );
    expect(result).toEqual({ strategy: "shares", weights: { ana: 2 } });
  });

  it("filters percentage basis points down to selected members only", () => {
    const result = buildSplitInput(
      state({
        strategy: "percentage",
        selectedIds: ["ana", "beto"],
        basisPoints: { ana: 6000, beto: 4000, caro: 5000 },
      }),
      allMembers,
    );
    expect(result).toEqual({ strategy: "percentage", basisPoints: { ana: 6000, beto: 4000 } });
  });

  it("filters exact amounts down to selected members only", () => {
    const result = buildSplitInput(
      state({ strategy: "exact", selectedIds: ["ana"], exactAmounts: { ana: "1000", beto: "2000" } }),
      allMembers,
    );
    expect(result).toEqual({ strategy: "exact", amounts: { ana: "1000" } });
  });

  it("builds a `loan` with the chosen beneficiary", () => {
    const result = buildSplitInput(state({ strategy: "loan", loanBeneficiary: "beto" }), allMembers);
    expect(result).toEqual({ strategy: "loan", to: "beto" });
  });

  it("falls back to the first member for `loan` when none is chosen yet", () => {
    const result = buildSplitInput(state({ strategy: "loan", loanBeneficiary: null }), allMembers);
    expect(result).toEqual({ strategy: "loan", to: "ana" });
  });
});
