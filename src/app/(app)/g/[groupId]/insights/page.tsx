import { apiFetchServer } from "../../../../../lib/api/server";
import { getGroupDetail } from "../_data";
import { InsightsTab } from "../_components/InsightsTab";
import type { InsightsResult } from "../_components/insightsTypes";

/**
 * Análisis tab (T081) — spending by period, by member, and by category,
 * one block per currency, hand-rolled SVG. Renders from `GET /api/groups/:id`
 * (member names) plus the tab's own `GET .../insights`, the same
 * "layout resolves the shared loaders" pattern the other tabs use (T106).
 */
export default async function InsightsTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ members }, insights] = await Promise.all([
    getGroupDetail(groupId),
    apiFetchServer<InsightsResult>(`/api/groups/${groupId}/insights`),
  ]);

  return <InsightsTab groupId={groupId} members={members} initialData={insights} />;
}
