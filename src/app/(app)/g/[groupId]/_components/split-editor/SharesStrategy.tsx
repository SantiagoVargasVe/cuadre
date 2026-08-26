import { es } from "../../../../../../lib/i18n/es";
import { NumberField, NumberFieldRoot } from "../../../../../_ui/NumberField";
import { MemberCheckboxList } from "./MemberCheckboxList";
import { ResolvedAmount } from "./ResolvedAmount";
import type { GroupMember } from "../types";

const t = es.splitEditor;

export interface SharesStrategyProps {
  members: GroupMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  weights: Record<string, number>;
  onWeightChange: (userId: string, weight: number) => void;
  preview: Map<string, bigint> | null;
  currency: string;
}

/** "The couple counts as two" — an integer stepper per member, ≥ 1. */
export function SharesStrategy({
  members,
  selectedIds,
  onToggle,
  weights,
  onWeightChange,
  preview,
  currency,
}: SharesStrategyProps) {
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
            value={weights[member.userId] ?? 1}
            min={1}
            step={1}
            onValueChange={(value: number | null) => value !== null && onWeightChange(member.userId, value)}
          >
            <NumberField className="h-8 w-24" aria-label={`${member.displayName}: ${t.sharesLabel}`} />
          </NumberFieldRoot>
        </div>
      )}
    />
  );
}
