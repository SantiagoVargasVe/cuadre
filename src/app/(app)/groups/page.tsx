import type { Metadata } from "next";
import { apiFetchServer } from "../../../lib/api/server";
import { es } from "../../../lib/i18n/es";
import { CreateGroupDialog } from "./_components/CreateGroupDialog";
import { GroupsList } from "./_components/GroupsList";
import type { MyGroupSummary } from "./_components/types";

export const metadata: Metadata = { title: "Grupos — Cuadre" };

/** Server-rendered (frontend/CLAUDE.md § *Data loading*): the app's home
 * screen, first paint on a phone over mobile data. */
export default async function GroupsPage() {
  const { items } = await apiFetchServer<{ items: MyGroupSummary[] }>("/api/groups");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{es.groups.heading}</h1>
        <CreateGroupDialog />
      </div>
      <GroupsList groups={items} />
    </div>
  );
}
