import { GroupHeading } from "../../../_shell/GroupHeading";
import { GroupTabs } from "../../../_shell/GroupTabs";
import { getGroupDetail } from "./_data";

interface GroupLayoutProps {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}

/**
 * The shell — heading + tab bar — is identical across all three tabs, so it
 * lives here and stays painted while a tab's `page` swaps out behind a
 * `loading.tsx` boundary (T106). It also does the one `GET /api/groups/:id`
 * the whole render pass needs (`getGroupDetail` is `React.cache`d), so the
 * heading no longer runs its own client fetch and the pages get a cache hit.
 */
export default async function GroupLayout({ children, params }: GroupLayoutProps) {
  const { groupId } = await params;
  const { group } = await getGroupDetail(groupId);

  return (
    <div className="flex flex-col gap-4">
      <GroupHeading title={group.title} />
      <GroupTabs groupId={groupId} />
      <div>{children}</div>
    </div>
  );
}
