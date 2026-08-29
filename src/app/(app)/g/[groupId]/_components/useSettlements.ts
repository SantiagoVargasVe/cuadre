"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import type { CreateSettlementInput } from "../../../../../lib/schemas/settlements";
import { toastManager } from "../../../../_ui/Toast";
import type { SettlementListResult, SettlementView } from "./settlementTypes";

const t = es.settlements;

/**
 * Settlement history + the three writes. Every write invalidates the whole
 * `["group", groupId]` key — one broad invalidation covers both the
 * settlements list and balances (TanStack prefix matching), and a stale
 * balance after a settlement is the most damaging wrong number this app can
 * show (frontend/CLAUDE.md § *Data*).
 *
 * `create` is **optimistic**: a settlement is a single amount the client
 * already knows, so the row appears immediately and rolls back with a toast
 * if the write fails (frontend/CLAUDE.md § *Data* — optimistic is for
 * toggles and settlement recording, never for expenses).
 */
export function useSettlements(groupId: string, myUserId: string, initialData: SettlementListResult) {
  const queryClient = useQueryClient();
  const key = ["group", groupId, "settlements"] as const;

  const list = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<SettlementListResult>(`/api/groups/${groupId}/settlements`),
    initialData,
    staleTime: Infinity,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["group", groupId] });

  const create = useMutation({
    mutationFn: (input: CreateSettlementInput) =>
      apiFetch<SettlementView>(`/api/groups/${groupId}/settlements`, { method: "POST", body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SettlementListResult>(key);
      const optimistic: SettlementView = {
        id: `optimistic-${Date.now()}`,
        fromUserId: myUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: input.currency,
        settledOn: input.settledOn,
        note: input.note ?? null,
      };
      queryClient.setQueryData<SettlementListResult>(key, (current) => ({
        items: [optimistic, ...(current?.items ?? [])],
        nextCursor: current?.nextCursor ?? null,
      }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toastManager.add({ title: t.saveError, type: "error" });
    },
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateSettlementInput }) =>
      apiFetch<SettlementView>(`/api/settlements/${id}`, { method: "PATCH", body: input }),
    onError: () => toastManager.add({ title: t.saveError, type: "error" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/settlements/${id}`, { method: "DELETE" }),
    onError: () => toastManager.add({ title: t.deleteError, type: "error" }),
    onSuccess: invalidate,
  });

  return { list, create, update, remove };
}
