"use client";

import { formatTimestamp } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { Avatar } from "../../../../_ui/Avatar";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { MemberSummary } from "./groupSettingsTypes";

const t = es.settings.members;

export interface MemberListProps {
  groupId: string;
  members: MemberSummary[];
  myUserId: string;
  amOwner: boolean;
}

/** Roles and join dates, never email addresses (security.md § Privacy). The
 * remove control is **absent** for a non-owner, not disabled
 * (design-system.md § Tests). */
export function MemberList({ groupId, members, myUserId, amOwner }: MemberListProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar userId={member.userId} avatar={member.avatar} />
              <div className="flex flex-col">
                <span className="text-sm text-foreground">
                  {member.displayName}
                  {member.userId === myUserId && ` ${t.you}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(member.role === "owner" ? t.roleOwner : t.roleMember)} · {t.joined(formatTimestamp(member.joinedAt))}
                </span>
              </div>
            </div>
            {amOwner && member.userId !== myUserId && (
              <RemoveMemberDialog groupId={groupId} member={member} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
