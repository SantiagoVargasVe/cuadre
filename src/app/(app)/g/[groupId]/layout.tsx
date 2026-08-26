import { GroupHeading } from "../../../_shell/GroupHeading";
import { GroupTabs } from "../../../_shell/GroupTabs";

interface GroupLayoutProps {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}

export default async function GroupLayout({ children, params }: GroupLayoutProps) {
  const { groupId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <GroupHeading groupId={groupId} />
      <GroupTabs groupId={groupId} />
      <div>{children}</div>
    </div>
  );
}
