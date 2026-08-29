import { apiFetchServer } from "../../../../../lib/api/server";
import { GroupSettings } from "../_components/GroupSettings";
import type { DisplayCurrencyState, MemberSummary } from "../_components/groupSettingsTypes";
import type { GroupDetailResult } from "../_components/types";

interface MeResponse {
  user: { id: string };
}

/** Ajustes tab (T068) — members, invite link, the currency switcher (it
 * lives here, not the header), and the owner-only rename/archive form. */
export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ group }, { members }, displayCurrency, { user }] = await Promise.all([
    apiFetchServer<GroupDetailResult>(`/api/groups/${groupId}`),
    apiFetchServer<{ members: MemberSummary[] }>(`/api/groups/${groupId}/members`),
    apiFetchServer<DisplayCurrencyState>(`/api/groups/${groupId}/display-currency`),
    apiFetchServer<MeResponse>("/api/auth/me"),
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
