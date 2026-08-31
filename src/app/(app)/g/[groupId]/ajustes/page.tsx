import { apiFetchServer } from "../../../../../lib/api/server";
import { getGroupDetail, getMe } from "../_data";
import { GroupSettings } from "../_components/GroupSettings";
import type { DisplayCurrencyState, MemberSummary } from "../_components/groupSettingsTypes";

/** Ajustes tab (T068) — members, invite link, the currency switcher (it
 * lives here, not the header), and the owner-only rename/archive form. The
 * full member list comes from `GET .../members` (roles + join dates);
 * `getGroupDetail`/`getMe` are the request-scoped loaders the layout
 * already resolved (T106). */
export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ group }, { members }, displayCurrency, { user }] = await Promise.all([
    getGroupDetail(groupId),
    apiFetchServer<{ members: MemberSummary[] }>(`/api/groups/${groupId}/members`),
    apiFetchServer<DisplayCurrencyState>(`/api/groups/${groupId}/display-currency`),
    getMe(),
  ]);

  return (
    <GroupSettings
      groupId={groupId}
      group={group}
      members={members}
      myUserId={user.id}
      displayCurrency={displayCurrency}
    />
  );
}
