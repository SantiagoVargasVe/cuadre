"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { Switch } from "../../../../_ui/Switch";
import type { BalancesResult } from "./balancesTypes";
import { CurrencyBalanceBlock } from "./CurrencyBalanceBlock";
import { SettleUpDialog } from "./SettleUpDialog";
import { SettlementList } from "./SettlementList";
import type { SettlementListResult } from "./settlementTypes";
import type { GroupMember } from "./types";
import { useSettlements } from "./useSettlements";

const t = es.balances;

export interface BalancesTabProps {
  groupId: string;
  myUserId: string;
  members: GroupMember[];
  defaultCurrency: string;
  initialSimplify: boolean;
  initialData: BalancesResult;
  initialSettlements: SettlementListResult;
}

/**
 * Toggling simplify is a `PATCH` on the group, not a client-side transform —
 * no local `simplified` boolean to drift (frontend/CLAUDE.md § *Balances and
 * the simplify toggle*). Settlements live here too: recorded from a plan
 * edge or standalone, and their history is editable/deletable like expenses.
 */
export function BalancesTab({
  groupId,
  myUserId,
  members,
  defaultCurrency,
  initialSimplify,
  initialData,
  initialSettlements,
}: BalancesTabProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["group", groupId, "balances"],
    queryFn: () => apiFetch<BalancesResult>(`/api/groups/${groupId}/balances`),
    initialData,
    staleTime: Infinity,
  });

  const settlements = useSettlements(groupId, myUserId, initialSettlements);

  const toggle = useMutation({
    mutationFn: (simplifyDebts: boolean) =>
      apiFetch<void>(`/api/groups/${groupId}`, { method: "PATCH", body: { simplifyDebts } }),
    // "group" ⊇ "group, balances" by TanStack prefix matching — one
    // invalidation, not a double refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
  });

  const simplified = data.byCurrency[0]?.simplified ?? initialSimplify;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{t.simplifyLabel}</span>
          <Switch checked={simplified} onCheckedChange={(c) => toggle.mutate(c)} disabled={toggle.isPending} />
        </label>
        <SettleUpDialog
          trigger={<Button size="sm" type="button">{es.settlements.record}</Button>}
          title={es.settlements.recordTitle}
          members={members}
          myUserId={myUserId}
          currency={defaultCurrency}
          mutations={settlements}
        />
      </div>

      {data.byCurrency.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium text-foreground">{t.zeroState.title}</p>
          <p className="text-sm text-muted-foreground">{t.zeroState.body}</p>
        </div>
      ) : (
        data.byCurrency.map((block) => (
          <CurrencyBalanceBlock key={block.currency} block={block} members={members} myUserId={myUserId} mutations={settlements} />
        ))
      )}

      <SettlementList members={members} myUserId={myUserId} mutations={settlements} />
    </div>
  );
}
