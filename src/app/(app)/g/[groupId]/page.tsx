import { apiFetchServer } from "../../../../lib/api/server";
import { getGroupDetail, getMe } from "./_data";
import { ExpenseFeed } from "./_components/ExpenseFeed";
import type { ExpenseListResult } from "./_components/types";

/** Gastos tab — server-rendered first page (T063), "load more" from there.
 * Group detail is fetched alongside for the add-expense form (T064): the
 * group's default currency and member list, both needed before the form
 * can even render its defaults. `getGroupDetail`/`getMe` are request-scoped
 * (`_data.ts`) — the group layout already resolved them, so these are cache
 * hits, not extra round trips (T106). */
export default async function ExpensesTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ items, nextCursor }, { user }, { group, members }] = await Promise.all([
    apiFetchServer<ExpenseListResult>(`/api/groups/${groupId}/expenses`),
    getMe(),
    getGroupDetail(groupId),
  ]);

  return (
    <ExpenseFeed
      groupId={groupId}
      myUserId={user.id}
      initialItems={items}
      initialCursor={nextCursor}
      members={members}
      defaultCurrency={group.defaultCurrency}
    />
  );
}
