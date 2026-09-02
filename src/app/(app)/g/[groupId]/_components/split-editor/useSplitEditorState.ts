import * as React from "react";
import type { SplitInput } from "../../../../../../lib/schemas/expenses";
import { buildSplitInput } from "./buildSplitInput";
import { deriveStrategyDefaults } from "./deriveStrategyDefaults";
import { initialSplitState } from "./initialState";
import { resolveSplitPreview } from "./resolve";
import type { SplitEditorState, StrategyName } from "./types";

export interface SplitEditorController {
  state: SplitEditorState;
  setStrategy: (next: StrategyName) => void;
  toggleMember: (userId: string) => void;
  setWeight: (userId: string, weight: number) => void;
  setBasisPoints: (userId: string, bp: number) => void;
  setExactAmount: (userId: string, amount: string) => void;
  setLoanBeneficiary: (userId: string) => void;
  preview: Map<string, bigint> | null;
  error: unknown;
  splitInput: SplitInput;
}

/** Owns every field across all five strategies (T065: "the shell owns the
 * live total and the save gate; each strategy owns its inputs"). One hook
 * rather than component state so `SplitEditor.tsx` itself stays a plain
 * render function under the 100-line limit. */
export function useSplitEditorState(
  memberIds: string[],
  totalAmount: bigint,
  seed: string,
  initialSplit?: SplitInput,
): SplitEditorController {
  const [state, setState] = React.useState(() => initialSplitState(memberIds, totalAmount, seed, initialSplit));

  const setStrategy = (next: StrategyName) =>
    setState((current) => {
      const derived = deriveStrategyDefaults(next, current, totalAmount, seed);
      return next === "equal"
        ? {
            ...derived,
            equalStrategy: current.selectedIds.length === memberIds.length ? "equal" : "equal_subset",
            equalMembersExplicit: current.selectedIds.length !== memberIds.length,
          }
        : derived;
    });

  const toggleMember = (userId: string) =>
    setState((current) => {
      const has = current.selectedIds.includes(userId);
      if (has && current.selectedIds.length === 1) return current; // at least one member, always
      const selectedIds = has
        ? current.selectedIds.filter((id) => id !== userId)
        : [...current.selectedIds, userId];
      return {
        ...current,
        selectedIds,
        equalStrategy: selectedIds.length === memberIds.length ? "equal" : "equal_subset",
        equalMembersExplicit: selectedIds.length !== memberIds.length,
      };
    });

  const setWeight = (userId: string, weight: number) =>
    setState((current) => ({ ...current, weights: { ...current.weights, [userId]: weight } }));

  const setBasisPoints = (userId: string, bp: number) =>
    setState((current) => ({ ...current, basisPoints: { ...current.basisPoints, [userId]: bp } }));

  const setExactAmount = (userId: string, amount: string) =>
    setState((current) => ({ ...current, exactAmounts: { ...current.exactAmounts, [userId]: amount } }));

  const setLoanBeneficiary = (userId: string) =>
    setState((current) => ({ ...current, loanBeneficiary: userId }));

  const splitInput = buildSplitInput(state, memberIds);

  // Recomputed on every render rather than memoized: the inputs are small
  // (2-15 members) and this is cheap integer arithmetic, so memoizing
  // would only add a dependency-array footgun for no measurable benefit.
  let preview: Map<string, bigint> | null = null;
  let error: unknown = null;
  if (totalAmount > 0n) {
    try {
      preview = resolveSplitPreview(splitInput, memberIds, totalAmount, seed);
    } catch (caught) {
      error = caught;
    }
  }

  return {
    state,
    setStrategy,
    toggleMember,
    setWeight,
    setBasisPoints,
    setExactAmount,
    setLoanBeneficiary,
    preview,
    error,
    splitInput,
  };
}
