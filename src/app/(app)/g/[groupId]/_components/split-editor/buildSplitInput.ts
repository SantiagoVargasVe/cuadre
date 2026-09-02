import type { SplitInput } from "../../../../../../lib/schemas/expenses";
import type { SplitEditorState } from "./types";

/** Filters the (kept-for-everyone) raw state down to the currently
 * selected members and shapes it into the wire `SplitInput` for whichever
 * strategy is active. `equalStrategy` preserves the stored spelling until
 * the member selection changes, so a title-only edit is a true round-trip. */
export function buildSplitInput(state: SplitEditorState, allMemberIds: string[]): SplitInput {
  const { strategy, selectedIds } = state;
  switch (strategy) {
    case "equal":
      if (state.equalStrategy === "equal_subset") return { strategy: "equal_subset", members: selectedIds };
      return state.equalMembersExplicit ? { strategy: "equal", members: selectedIds } : { strategy: "equal" };
    case "shares":
      return { strategy: "shares", weights: pick(state.weights, selectedIds) };
    case "percentage":
      return { strategy: "percentage", basisPoints: pick(state.basisPoints, selectedIds) };
    case "exact":
      return { strategy: "exact", amounts: pick(state.exactAmounts, selectedIds) };
    case "loan":
      return { strategy: "loan", to: state.loanBeneficiary ?? allMemberIds[0]! };
  }
}

function pick<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  const result: Record<string, T> = {};
  for (const id of ids) {
    const value = record[id];
    if (value !== undefined) result[id] = value;
  }
  return result;
}
