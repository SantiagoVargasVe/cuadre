"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { InsightsCurrencySection } from "./InsightsCurrencySection";
import type { InsightsResult } from "./insightsTypes";
import { buildMemberLookup } from "./memberLookup";
import type { GroupMember } from "./types";

const t = es.insights;

/**
 * The Análisis tab (T081). Server-rendered first paint from `GET
 * .../insights`, then the same TanStack pattern the other tabs use so a
 * later expense edit that invalidates `["group", groupId]` refetches it.
 * All aggregation is server-side; this only maps ids to names and renders.
 */
export function InsightsTab({
  groupId,
  members,
  initialData,
}: {
  groupId: string;
  members: GroupMember[];
  initialData: InsightsResult;
}) {
  const { data } = useQuery({
    queryKey: ["group", groupId, "insights"],
    queryFn: () => apiFetch<InsightsResult>(`/api/groups/${groupId}/insights`),
    initialData,
    staleTime: Infinity,
  });
  const { nameOf } = buildMemberLookup(members);

  if (data.byCurrency.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="font-medium text-foreground">{t.empty.title}</p>
        <p className="text-sm text-muted-foreground">{t.empty.body}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      {data.byCurrency.map((block) => (
        <InsightsCurrencySection key={block.currency} block={block} nameOf={nameOf} />
      ))}
    </div>
  );
}
