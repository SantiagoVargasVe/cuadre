import { equalDefault } from "./resolve";
import type { SplitEditorState, StrategyName } from "./types";

/**
 * Fills in a sensible starting point for whichever strategy the member
 * just switched *into*, over the currently-selected members — "resolved
 * per-member amounts are always shown, including for equal" (T065)
 * extends naturally to "never opens on an empty exact/percentage field."
 * Existing entries for members outside the current selection are left
 * untouched (buildSplitInput.ts filters them out; deriving here would
 * just discard work if they're re-checked later).
 */
export function deriveStrategyDefaults(
  next: StrategyName,
  state: SplitEditorState,
  totalAmount: bigint,
  seed: string,
): SplitEditorState {
  const ids = state.selectedIds;
  if (next === "shares") {
    return { ...state, strategy: next, weights: { ...state.weights, ...onlyMissing(state.weights, ids, 1) } };
  }
  if (next === "percentage" && totalAmount > 0n) {
    const bp = Object.fromEntries([...equalDefault(10000n, ids, seed)].map(([id, v]) => [id, Number(v)]));
    return { ...state, strategy: next, basisPoints: bp };
  }
  if (next === "exact" && totalAmount > 0n) {
    const amounts = Object.fromEntries(
      [...equalDefault(totalAmount, ids, seed)].map(([id, v]) => [id, v.toString()]),
    );
    return { ...state, strategy: next, exactAmounts: amounts };
  }
  if (next === "loan") {
    const beneficiary = state.loanBeneficiary && ids.includes(state.loanBeneficiary) ? state.loanBeneficiary : ids[0];
    return { ...state, strategy: next, loanBeneficiary: beneficiary ?? null };
  }
  return { ...state, strategy: next };
}

function onlyMissing(record: Record<string, number>, ids: string[], value: number): Record<string, number> {
  return Object.fromEntries(ids.filter((id) => record[id] === undefined).map((id) => [id, value]));
}
