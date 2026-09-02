import type { SplitInput } from "../../../../../../lib/schemas/expenses";
import { equalDefault } from "./resolve";
import type { SplitEditorState } from "./types";

export function initialSplitState(
  memberIds: string[],
  totalAmount: bigint,
  seed: string,
  initial?: SplitInput,
): SplitEditorState {
  const equalAmounts = totalAmount > 0n ? equalDefault(totalAmount, memberIds, seed) : new Map();
  const equalBp = totalAmount > 0n ? equalDefault(10000n, memberIds, seed) : new Map();
  const base: SplitEditorState = {
    strategy: "equal",
    equalStrategy: "equal",
    equalMembersExplicit: false,
    selectedIds: memberIds,
    weights: Object.fromEntries(memberIds.map((id) => [id, 1])),
    basisPoints: Object.fromEntries([...equalBp].map(([id, value]) => [id, Number(value)])),
    exactAmounts: Object.fromEntries([...equalAmounts].map(([id, value]) => [id, value.toString()])),
    loanBeneficiary: memberIds[0] ?? null,
  };
  if (!initial) return base;
  if (initial.strategy === "equal" || initial.strategy === "equal_subset") {
    return {
      ...base,
      equalStrategy: initial.strategy,
      equalMembersExplicit: Boolean(initial.members),
      selectedIds: initial.members ?? memberIds,
    };
  }
  if (initial.strategy === "shares") {
    return { ...base, strategy: "shares", selectedIds: Object.keys(initial.weights), weights: initial.weights };
  }
  if (initial.strategy === "percentage") {
    return {
      ...base,
      strategy: "percentage",
      selectedIds: Object.keys(initial.basisPoints),
      basisPoints: initial.basisPoints,
    };
  }
  if (initial.strategy === "exact") {
    return { ...base, strategy: "exact", selectedIds: Object.keys(initial.amounts), exactAmounts: initial.amounts };
  }
  return { ...base, strategy: "loan", loanBeneficiary: initial.to };
}
