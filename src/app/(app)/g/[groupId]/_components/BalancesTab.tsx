"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Switch } from "../../../../_ui/Switch";
import type { BalancesResult } from "./balancesTypes";
import { CurrencyBalanceBlock } from "./CurrencyBalanceBlock";
import type { GroupMember } from "./types";

const t = es.balances;

export interface BalancesTabProps {
  groupId: string;
  myUserId: string;
  members: GroupMember[];
  initialSimplify: boolean;
  initialData: BalancesResult;
}

/**
 * Toggling simplify is a `PATCH` on the group, not a client-side
 * transform — there is deliberately no local `simplified` boolean to get
 * out of sync (frontend/CLAUDE.md § *Balances and the simplify toggle*).
 * The switch's own checked state reads straight off the last balances
 * response instead, so "off" and "on" are the same query re-rendered with
 * whatever the server just computed.
 */
export function BalancesTab({ groupId, myUserId, members, initialSimplify, initialData }: BalancesTabProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["group", groupId, "balances"],
    queryFn: () => apiFetch<BalancesResult>(`/api/groups/${groupId}/balances`),
    initialData,
    // The server just fetched this on this very request — only a mutation
    // that invalidates the key (a new expense, a settlement, this toggle)
    // should ever ask for it again, never a wall-clock timer.
    staleTime: Infinity,
  });

  const toggle = useMutation({
    mutationFn: (simplifyDebts: boolean) =>
      apiFetch<void>(`/api/groups/${groupId}`, { method: "PATCH", body: { simplifyDebts } }),
    // A single, broader invalidation — "group" ⊇ "group, balances" by
    // TanStack's own prefix matching — so an active balances query isn't
    // refetched twice for the one PATCH that changed it.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });

  const simplified = data.byCurrency[0]?.simplified ?? initialSimplify;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
        <span className="text-sm font-medium text-foreground">{t.simplifyLabel}</span>
        <Switch checked={simplified} onCheckedChange={(checked) => toggle.mutate(checked)} disabled={toggle.isPending} />
      </label>

      {data.byCurrency.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium text-foreground">{t.zeroState.title}</p>
          <p className="text-sm text-muted-foreground">{t.zeroState.body}</p>
        </div>
      ) : (
        data.byCurrency.map((block) => (
          <CurrencyBalanceBlock key={block.currency} block={block} members={members} myUserId={myUserId} />
        ))
      )}
    </div>
  );
}
