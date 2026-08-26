import { NumberField, NumberFieldRoot } from "../../../../../_ui/NumberField";
import { MemberCheckboxList } from "./MemberCheckboxList";
import { ResolvedAmount } from "./ResolvedAmount";
import type { GroupMember } from "../types";

export interface PercentageStrategyProps {
  members: GroupMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  basisPoints: Record<string, number>;
  onBasisPointsChange: (userId: string, bp: number) => void;
  preview: Map<string, bigint> | null;
  currency: string;
}

/** Displayed as a percent (two decimals), held as basis points — integers,
 * never a float percentage (splitting.md § 3: "60% is 6000"). The 0.01
 * step times 100 always lands on an integer, so the conversion here never
 * needs rounding. */
export function PercentageStrategy({
  members,
  selectedIds,
  onToggle,
  basisPoints,
  onBasisPointsChange,
  preview,
  currency,
}: PercentageStrategyProps) {
  return (
    <MemberCheckboxList
      members={members}
      selectedIds={selectedIds}
      onToggle={onToggle}
      renderControl={(member) => (
        <div className="flex items-center gap-3">
          <ResolvedAmount
            amount={preview?.get(member.userId)}
            currency={currency}
            displayName={member.displayName}
          />
          <NumberFieldRoot
            value={(basisPoints[member.userId] ?? 0) / 100}
            min={0}
            max={100}
            step={0.01}
            onValueChange={(value: number | null) =>
              value !== null && onBasisPointsChange(member.userId, Math.round(value * 100))
            }
          >
            <NumberField className="h-8 w-28" aria-label={`${member.displayName}: %`} />
          </NumberFieldRoot>
        </div>
      )}
    />
  );
}
