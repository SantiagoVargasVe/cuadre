"use client";

import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { Switch } from "../../../../_ui/Switch";
import { CopyPaymentPlanButton } from "./CopyPaymentPlanButton";
import { SettleUpDialog } from "./SettleUpDialog";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

const t = es.balances;

export interface BalancesToolbarProps {
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  defaultCurrency: string;
  presentCurrencies: string[];
  mutations: ReturnType<typeof useSettlements>;
  simplified: boolean;
  togglePending: boolean;
  onToggle: (simplify: boolean) => void;
  /** The clipboard text for the plan on screen, or `""` when the group is
   * settled — which is what removes the action rather than disabling it. */
  planText: string;
}

/** The controls above the currency blocks: what the plan looks like
 * (simplify), how to record a payment, and how to share the plan (T116). */
export function BalancesToolbar({
  groupId,
  members,
  myUserId,
  defaultCurrency,
  presentCurrencies,
  mutations,
  simplified,
  togglePending,
  onToggle,
  planText,
}: BalancesToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{t.simplifyLabel}</span>
          <Switch checked={simplified} onCheckedChange={onToggle} disabled={togglePending} />
        </label>
        <SettleUpDialog
          trigger={<Button size="sm" type="button">{es.settlements.record}</Button>}
          title={es.settlements.recordTitle}
          groupId={groupId}
          members={members}
          myUserId={myUserId}
          currency={defaultCurrency}
          presentCurrencies={presentCurrencies}
          mutations={mutations}
        />
      </div>
      {/* Its own row, so sharing never competes with the switch or
          Registrar pago for space on a phone. */}
      {planText && <CopyPaymentPlanButton text={planText} />}
    </div>
  );
}
