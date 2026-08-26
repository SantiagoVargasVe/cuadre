export type StrategyName = "equal" | "shares" | "percentage" | "exact" | "loan";

/** Raw, per-strategy editing state — kept for *every* member, not just
 * currently-selected ones, so unchecking someone and rechecking them
 * later doesn't lose whatever they'd already been given (T065: switching
 * strategies keeps the member selection; this is the same idea applied to
 * a single member's checkbox). */
export interface SplitEditorState {
  strategy: StrategyName;
  selectedIds: string[];
  weights: Record<string, number>;
  basisPoints: Record<string, number>;
  exactAmounts: Record<string, string>;
  loanBeneficiary: string | null;
}
