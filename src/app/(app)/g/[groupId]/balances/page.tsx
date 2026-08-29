import { apiFetchServer } from "../../../../../lib/api/server";
import type { BalancesResult } from "../_components/balancesTypes";
import { BalancesTab } from "../_components/BalancesTab";
import type { SettlementListResult } from "../_components/settlementTypes";
import type { GroupDetailResult } from "../_components/types";

interface MeResponse {
  user: { id: string };
}

/** Balances tab (T066, T067) — server-rendered first paint from the group's
 * own `settings.simplifyDebts` plus `GET .../balances` and
 * `GET .../settlements`, the "renders from GET /api/groups/:id plus the
 * tab's own endpoint" pattern the other tabs already use. */
export default async function BalancesTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ group, members, settings }, balances, settlements, { user }] = await Promise.all([
    apiFetchServer<GroupDetailResult>(`/api/groups/${groupId}`),
    apiFetchServer<BalancesResult>(`/api/groups/${groupId}/balances`),
    apiFetchServer<SettlementListResult>(`/api/groups/${groupId}/settlements`),
    apiFetchServer<MeResponse>("/api/auth/me"),
  ]);

  return (
    <BalancesTab
      groupId={groupId}
      myUserId={user.id}
      members={members}
      defaultCurrency={group.defaultCurrency}
      initialSimplify={settings.simplifyDebts}
      initialData={balances}
      initialSettlements={settlements}
    />
  );
}
