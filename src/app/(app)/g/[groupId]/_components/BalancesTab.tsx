"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import type { BalancesResult } from "./balancesTypes";
import { BalancesToolbar } from "./BalancesToolbar";
import { CurrencyBalanceBlock } from "./CurrencyBalanceBlock";
import { formatPaymentPlanForClipboard } from "./formatPaymentPlanForClipboard";
import { buildMemberLookup } from "./memberLookup";
import { SettlementList } from "./SettlementList";
import type { SettlementListResult } from "./settlementTypes";
import type { GroupMember } from "./types";
import { useSettlements } from "./useSettlements";

const t = es.balances;

export interface BalancesTabProps {
  groupId: string;
  /** From the server-rendered page, so the copied message names the group
   * it belongs to without another request (T116). */
  groupTitle: string;
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
  groupTitle,
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
  // The currencies the settle-up select offers — the group default plus any
  // with live activity, never every supported code (T104).
  const presentCurrencies = Array.from(
    new Set([defaultCurrency, ...data.byCurrency.map((b) => b.currency)]),
  );
  // Built from `data`, the live query result — a simplify toggle or a
  // recorded settlement invalidates ["group", groupId] and this rebuilds.
  // Empty for a settled group, which is what hides the action entirely.
  const planText = formatPaymentPlanForClipboard({
    groupTitle,
    balances: data,
    nameOf: buildMemberLookup(members).nameOf,
  });

  return (
    <div className="flex flex-col gap-4 pb-20">
      <BalancesToolbar
        groupId={groupId}
        members={members}
        myUserId={myUserId}
        defaultCurrency={defaultCurrency}
        presentCurrencies={presentCurrencies}
        mutations={settlements}
        simplified={simplified}
        togglePending={toggle.isPending}
        onToggle={(simplify) => toggle.mutate(simplify)}
        planText={planText}
      />

      {data.byCurrency.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium text-foreground">{t.zeroState.title}</p>
          <p className="text-sm text-muted-foreground">{t.zeroState.body}</p>
        </div>
      ) : (
        data.byCurrency.map((block) => (
          <CurrencyBalanceBlock
            key={block.currency}
            groupId={groupId}
            block={block}
            members={members}
            myUserId={myUserId}
            presentCurrencies={presentCurrencies}
            mutations={settlements}
          />
        ))
      )}

      <SettlementList
        groupId={groupId}
        members={members}
        myUserId={myUserId}
        presentCurrencies={presentCurrencies}
        mutations={settlements}
      />
    </div>
  );
}
