import type * as React from "react";
import { formatAmountInputValue, parseAmountInput } from "../../../../../../lib/money/format";
import { MoneyField } from "../../../../../_ui/MoneyField";
import { MemberCheckboxList } from "./MemberCheckboxList";
import type { GroupMember } from "../types";

export interface ExactStrategyProps {
  members: GroupMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  exactAmounts: Record<string, string>;
  onAmountChange: (userId: string, minorUnits: string) => void;
  currency: string;
}

/** A `<MoneyField>` per member — the caller supplies the answer directly,
 * no apportionment (splitting.md § 3). Prefilled with an even split so the
 * editor never opens on all-empty fields; the live remainder (shown by
 * the shell via `RemainderText`) is what tells the user when their edits
 * have moved it out of balance. */
export function ExactStrategy({
  members,
  selectedIds,
  onToggle,
  exactAmounts,
  onAmountChange,
  currency,
}: ExactStrategyProps) {
  return (
    <MemberCheckboxList
      members={members}
      selectedIds={selectedIds}
      onToggle={onToggle}
      renderControl={(member) => (
        <MoneyField
          label=""
          aria-label={member.displayName}
          currency={currency}
          className="h-8 w-32"
          defaultValue={
            exactAmounts[member.userId]
              ? formatAmountInputValue(BigInt(exactAmounts[member.userId]!), currency)
              : ""
          }
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onAmountChange(member.userId, parseAmountInput(event.target.value, currency).toString())
          }
        />
      )}
    />
  );
}
