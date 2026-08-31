"use client";

import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import type { MemberLookup } from "./memberLookup";
import { PaymentPlanRow } from "./PaymentPlanRow";
import { SettleUpDialog } from "./SettleUpDialog";
import type { CurrencyBalancesView } from "./balancesTypes";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

const t = es.balances;

export interface PaymentPlanSectionProps {
  groupId: string;
  block: CurrencyBalancesView;
  members: GroupMember[];
  myUserId: string;
  presentCurrencies: string[];
  mutations: ReturnType<typeof useSettlements>;
  nameOf: MemberLookup["nameOf"];
  avatarOf: MemberLookup["avatarOf"];
}

/** The "who pays whom" list, plus a "Registrar pago" that prefills the
 * settle-up form from an edge — but only on an edge the acting user is the
 * payer of, since `fromUserId` is always them (ADR-0009). */
export function PaymentPlanSection({
  groupId,
  block,
  members,
  myUserId,
  presentCurrencies,
  mutations,
  nameOf,
  avatarOf,
}: PaymentPlanSectionProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-xs font-medium text-muted-foreground">{t.planHeading}</h3>
      {block.plan.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.settledBlock}</p>
      ) : (
        block.plan.map((edge) => (
          <div key={`${edge.from}-${edge.to}`} className="flex items-center justify-between gap-2">
            <PaymentPlanRow edge={edge} currency={block.currency} myUserId={myUserId} nameOf={nameOf} avatarOf={avatarOf} />
            {edge.from === myUserId && (
              <SettleUpDialog
                trigger={<Button variant="ghost" size="sm" type="button">{es.settlements.record}</Button>}
                title={es.settlements.recordTitle}
                groupId={groupId}
                members={members}
                myUserId={myUserId}
                currency={block.currency}
                presentCurrencies={presentCurrencies}
                mutations={mutations}
                prefill={{ toUserId: edge.to, amountMinor: edge.amount }}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
