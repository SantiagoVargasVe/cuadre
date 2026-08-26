import { es } from "../../../../../../lib/i18n/es";
import { RadioGroup, RadioItem } from "../../../../../_ui/RadioGroup";
import type { GroupMember } from "../types";

const t = es.splitEditor;

export interface LoanStrategyProps {
  members: GroupMember[];
  beneficiary: string | null;
  onChange: (userId: string) => void;
}

/** "One payer, one split member at 100%" (splitting.md § 3) — the payer
 * side is whatever `PayerEditor` already has; this only picks who the
 * money was for. */
export function LoanStrategy({ members, beneficiary, onChange }: LoanStrategyProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{t.beneficiaryLabel}</span>
      <RadioGroup<string> value={beneficiary ?? undefined} onValueChange={(value) => onChange(value)}>
        {members.map((member) => (
          <RadioItem key={member.userId} value={member.userId} label={member.displayName} />
        ))}
      </RadioGroup>
    </div>
  );
}
