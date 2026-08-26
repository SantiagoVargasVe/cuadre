import { apiFetchServer } from "../../../../lib/api/server";
import { ExpenseFeed } from "./_components/ExpenseFeed";
import type { ExpenseListResult } from "./_components/types";

interface MeResponse {
  user: { id: string };
}

/** Gastos tab — server-rendered first page (T063), "load more" from there. */
export default async function ExpensesTabPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [{ items, nextCursor }, { user }] = await Promise.all([
    apiFetchServer<ExpenseListResult>(`/api/groups/${groupId}/expenses`),
    apiFetchServer<MeResponse>("/api/auth/me"),
  ]);

  return (
    <ExpenseFeed
      groupId={groupId}
      myUserId={user.id}
      initialItems={items}
      initialCursor={nextCursor}
    />
  );
}
