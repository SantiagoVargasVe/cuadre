import { apiFetchServer } from "../../../../../lib/api/server";
import type { BalancesResult } from "../_components/balancesTypes";
import { BalancesTab } from "../_components/BalancesTab";
import type { GroupDetailResult } from "../_components/types";

interface MeResponse {
  user: { id: string };
}

/** Balances tab (T066) — server-rendered first paint from the group's own
 * `settings.simplifyDebts` plus `GET .../balances`, the same "renders from
 * GET /api/groups/:id plus the tab's own endpoint" pattern the Gastos tab
 * (T063) already uses. */
export default async function BalancesTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ members, settings }, balances, { user }] = await Promise.all([
    apiFetchServer<GroupDetailResult>(`/api/groups/${groupId}`),
    apiFetchServer<BalancesResult>(`/api/groups/${groupId}/balances`),
    apiFetchServer<MeResponse>("/api/auth/me"),
  ]);

  return (
    <BalancesTab
      groupId={groupId}
      myUserId={user.id}
      members={members}
      initialSimplify={settings.simplifyDebts}
      initialData={balances}
    />
  );
}
