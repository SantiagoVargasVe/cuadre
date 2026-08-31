"use client";

import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { Avatar } from "../../../../_ui/Avatar";
import { Button } from "../../../../_ui/Button";
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { Money } from "../../../../_ui/Money";
import type { MemberLookup } from "./memberLookup";
import { SettleUpDialog } from "./SettleUpDialog";
import type { SettlementView } from "./settlementTypes";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

const t = es.settlements;

export interface SettlementRowProps {
  groupId: string;
  settlement: SettlementView;
  members: GroupMember[];
  myUserId: string;
  presentCurrencies: string[];
  mutations: ReturnType<typeof useSettlements>;
  nameOf: MemberLookup["nameOf"];
  avatarOf: MemberLookup["avatarOf"];
}

/** One recorded payment. Editable and deletable by any member, the same
 * rule as expenses (services/settlements.ts). */
export function SettlementRow({
  groupId,
  settlement,
  members,
  myUserId,
  presentCurrencies,
  mutations,
  nameOf,
  avatarOf,
}: SettlementRowProps) {
  const phrase = t.paidPhrase(nameOf(settlement.fromUserId), nameOf(settlement.toUserId));

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-foreground">
          <Avatar userId={settlement.fromUserId} avatar={avatarOf(settlement.fromUserId)} size={24} />
          {phrase}
        </span>
        <Money
          value={{ amount: BigInt(settlement.amount), currency: settlement.currency }}
          className="text-sm font-medium"
        />
      </div>
      <span className="text-xs text-muted-foreground">{formatCalendarDate(settlement.settledOn)}</span>
      {settlement.note && <p className="text-xs text-foreground">{settlement.note}</p>}
      <div className="mt-1 flex gap-2">
        <SettleUpDialog
          trigger={<Button variant="ghost" size="sm" type="button">{t.edit}</Button>}
          title={t.editTitle}
          groupId={groupId}
          members={members}
          myUserId={myUserId}
          currency={settlement.currency}
          presentCurrencies={presentCurrencies}
          mutations={mutations}
          settlement={settlement}
        />
        <DialogRoot>
          <DialogTrigger render={<Button variant="ghost" size="sm" type="button">{t.delete}</Button>} />
          <DialogContent>
            <DialogTitle className="text-lg font-semibold text-foreground">{t.deleteTitle}</DialogTitle>
            <p className="mt-2 text-sm text-foreground">{t.deleteConfirm(phrase)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
              <DialogClose
                render={<Button variant="destructive" type="button" />}
                onClick={() => mutations.remove.mutate(settlement.id)}
              >
                {t.delete}
              </DialogClose>
            </div>
          </DialogContent>
        </DialogRoot>
      </div>
    </li>
  );
}
