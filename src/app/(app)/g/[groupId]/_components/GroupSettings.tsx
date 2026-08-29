"use client";

import { CurrencySwitcher } from "./CurrencySwitcher";
import { GroupMetaForm } from "./GroupMetaForm";
import type { DisplayCurrencyState, MemberSummary } from "./groupSettingsTypes";
import { InvitePanel } from "./InvitePanel";
import { MemberList } from "./MemberList";

export interface GroupSettingsProps {
  groupId: string;
  group: { title: string; description: string | null; archivedAt: string | null };
  members: MemberSummary[];
  myUserId: string;
  displayCurrency: DisplayCurrencyState;
}

/** The Ajustes tab. Two of its controls (remove member, currency switch)
 * change every member's view — the sections are written to be honest about
 * that rather than looking like personal preferences (T068). */
export function GroupSettings({ groupId, group, members, myUserId, displayCurrency }: GroupSettingsProps) {
  const amOwner = members.some((m) => m.userId === myUserId && m.role === "owner");

  return (
    <div className="flex flex-col gap-4 pb-20">
      <MemberList groupId={groupId} members={members} myUserId={myUserId} amOwner={amOwner} />
      <InvitePanel groupId={groupId} />
      <CurrencySwitcher groupId={groupId} initial={displayCurrency} />
      {amOwner && (
        <GroupMetaForm
          groupId={groupId}
          title={group.title}
          description={group.description ?? ""}
          archivedAt={group.archivedAt}
        />
      )}
    </div>
  );
}
