import * as React from "react";
import { Checkbox } from "../../../../../_ui/Checkbox";
import type { GroupMember } from "../types";

export interface MemberCheckboxListProps {
  members: GroupMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  /** Extra control shown next to a checked member — the shares stepper,
   * the percent field, the exact-amount field. Absent for `equal`, which
   * has nothing to enter beyond the checkbox itself. */
  renderControl?: (member: GroupMember) => React.ReactNode;
}

/** The member list every strategy but `loan` is built from — kept as one
 * component so a checkbox toggling behaves identically everywhere
 * (design-system.md § *Composability over configuration*). */
export function MemberCheckboxList({ members, selectedIds, onToggle, renderControl }: MemberCheckboxListProps) {
  const selected = new Set(selectedIds);
  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <div key={member.userId} className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.has(member.userId)} onCheckedChange={() => onToggle(member.userId)} />
            {member.displayName}
          </label>
          {renderControl && selected.has(member.userId) && renderControl(member)}
        </div>
      ))}
    </div>
  );
}
