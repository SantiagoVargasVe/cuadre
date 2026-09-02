export type StrategyName = "equal" | "shares" | "percentage" | "exact" | "loan";

/** Raw, per-strategy editing state — kept for *every* member, not just
 * currently-selected ones, so unchecking someone and rechecking them
 * later doesn't lose whatever they'd already been given (T065: switching
 * strategies keeps the member selection; this is the same idea applied to
 * a single member's checkbox). */
export interface SplitEditorState {
  strategy: StrategyName;
  /** Keeps an untouched historical `equal` input distinct from
   * `equal_subset`; the UI presents both through the same strategy tab. */
  equalStrategy: "equal" | "equal_subset";
  /** A stored equal expense names its historical participants explicitly;
   * a new untouched equal split omits them for the minimal payload. */
  equalMembersExplicit: boolean;
  selectedIds: string[];
  weights: Record<string, number>;
  basisPoints: Record<string, number>;
  exactAmounts: Record<string, string>;
  loanBeneficiary: string | null;
}
