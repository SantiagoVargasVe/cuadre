import { es } from "../../../../lib/i18n/es";
import { EmptyState } from "./EmptyState";
import { GroupCard } from "./GroupCard";
import type { MyGroupSummary } from "./types";

const t = es.groups;

/** Archived groups render in their own section, never mixed in or
 * dropped (T062's own acceptance criteria: "visually separated, not
 * silently dropped" — a finished trip shouldn't vanish from the list it
 * once appeared in). */
export function GroupsList({ groups }: { groups: MyGroupSummary[] }) {
  if (groups.length === 0) return <EmptyState />;

  const active = groups.filter((group) => !group.archivedAt);
  const archived = groups.filter((group) => group.archivedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {active.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
      {archived.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t.archivedSectionTitle}</h2>
          {archived.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
