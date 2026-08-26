import { MemberCheckboxList } from "./MemberCheckboxList";
import { ResolvedAmount } from "./ResolvedAmount";
import type { GroupMember } from "../types";

export interface EqualStrategyProps {
  members: GroupMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  preview: Map<string, bigint> | null;
  currency: string;
}

/** `equal` / `equal_subset` — all checked means `equal` (splitting.md § 3). */
export function EqualStrategy({ members, selectedIds, onToggle, preview, currency }: EqualStrategyProps) {
  return (
    <MemberCheckboxList
      members={members}
      selectedIds={selectedIds}
      onToggle={onToggle}
      renderControl={(member) => (
        <ResolvedAmount amount={preview?.get(member.userId)} currency={currency} displayName={member.displayName} />
      )}
    />
  );
}
