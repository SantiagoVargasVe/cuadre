import type { GroupMember } from "../types";
import { EqualStrategy } from "./EqualStrategy";
import { ExactStrategy } from "./ExactStrategy";
import { LoanStrategy } from "./LoanStrategy";
import { PercentageStrategy } from "./PercentageStrategy";
import { SharesStrategy } from "./SharesStrategy";
import type { useSplitEditorState } from "./useSplitEditorState";

/** Dispatches to the one component that owns the active strategy's own
 * inputs (T065: "the shell owns the live total and the save gate; each
 * strategy owns its inputs"). */
export function StrategyPanel({
  members,
  controller: c,
  currency,
}: {
  members: GroupMember[];
  controller: ReturnType<typeof useSplitEditorState>;
  currency: string;
}) {
  switch (c.state.strategy) {
    case "equal":
      return (
        <EqualStrategy
          members={members}
          selectedIds={c.state.selectedIds}
          onToggle={c.toggleMember}
          preview={c.preview}
          currency={currency}
        />
      );
    case "shares":
      return (
        <SharesStrategy
          members={members}
          selectedIds={c.state.selectedIds}
          onToggle={c.toggleMember}
          weights={c.state.weights}
          onWeightChange={c.setWeight}
          preview={c.preview}
          currency={currency}
        />
      );
    case "percentage":
      return (
        <PercentageStrategy
          members={members}
          selectedIds={c.state.selectedIds}
          onToggle={c.toggleMember}
          basisPoints={c.state.basisPoints}
          onBasisPointsChange={c.setBasisPoints}
          preview={c.preview}
          currency={currency}
        />
      );
    case "exact":
      return (
        <ExactStrategy
          members={members}
          selectedIds={c.state.selectedIds}
          onToggle={c.toggleMember}
          exactAmounts={c.state.exactAmounts}
          onAmountChange={c.setExactAmount}
          currency={currency}
        />
      );
    case "loan":
      return <LoanStrategy members={members} beneficiary={c.state.loanBeneficiary} onChange={c.setLoanBeneficiary} />;
  }
}
