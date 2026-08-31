"use client";

import * as React from "react";
import { formatAmountInputValue } from "../../../../../lib/money/format";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { SettlementForm } from "./SettlementForm";
import type { SettlementView } from "./settlementTypes";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

type Mutations = Pick<ReturnType<typeof useSettlements>, "create" | "update">;

export interface SettleUpDialogProps {
  trigger: React.ReactElement;
  title: string;
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  /** The currency the form opens in — the select's default, no longer fixed
   * by which button was pressed (T104). */
  currency: string;
  /** Currencies actually present in the group — what the select offers. */
  presentCurrencies: string[];
  mutations: Mutations;
  /** Prefill from a plan edge (ADR-0009): a convenience only, nothing links
   * the settlement back to the edge. `amountMinor` is minor units, as the
   * balances endpoint gives it. */
  prefill?: { toUserId: string; amountMinor: string };
  /** Present → the dialog edits this settlement instead of creating one. */
  settlement?: SettlementView;
}

/**
 * Records a payment. Reachable from a plan edge (prefilled) and standalone
 * (pick a member, enter an amount). The amount stays editable and any
 * positive amount is accepted — someone owing 47.300 sending a round 50.000
 * is the expected case, not an error (T067).
 */
export function SettleUpDialog({
  trigger,
  title,
  groupId,
  members,
  myUserId,
  currency,
  presentCurrencies,
  mutations,
  prefill,
  settlement,
}: SettleUpDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { create, update } = mutations;

  const defaults = settlement
    ? {
        toUserId: settlement.toUserId,
        currency: settlement.currency,
        amount: formatAmountInputValue(BigInt(settlement.amount), settlement.currency),
        settledOn: settlement.settledOn,
        note: settlement.note ?? "",
      }
    : prefill
      ? {
          toUserId: prefill.toUserId,
          currency,
          amount: formatAmountInputValue(BigInt(prefill.amountMinor), currency),
        }
      : undefined;

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
        <SettlementForm
          groupId={groupId}
          members={members}
          myUserId={myUserId}
          currency={currency}
          presentCurrencies={presentCurrencies}
          defaults={defaults}
          submitting={create.isPending || update.isPending}
          onSubmit={(input) => {
            const onSuccess = () => setOpen(false);
            if (settlement) update.mutate({ id: settlement.id, input }, { onSuccess });
            else create.mutate(input, { onSuccess });
          }}
        />
      </DialogContent>
    </DialogRoot>
  );
}
