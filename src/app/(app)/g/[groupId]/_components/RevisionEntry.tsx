import { formatTimestamp } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { RevisionChange } from "./RevisionChange";
import type { ExpenseRevision } from "./revisionTypes";

const t = es.expenseHistory;

function actorName(revision: ExpenseRevision): string {
  return revision.changedBy?.displayName ?? t.unknownActor;
}

function summary(revision: ExpenseRevision): string {
  const actor = actorName(revision);
  if (revision.action === "created") return t.created(actor, formatTimestamp(revision.changedAt));
  if (revision.action === "deleted") return t.deleted(actor, formatTimestamp(revision.changedAt));
  return t.updated(actor, formatTimestamp(revision.changedAt));
}

/** A revision action plus the fields the server says changed; no client-side diffing. */
export function RevisionEntry({ revision }: { revision: ExpenseRevision }) {
  return (
    <li className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium text-foreground">{summary(revision)}</p>
      {revision.action === "updated" && revision.changes.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          {revision.changes.map((change, index) => (
            <RevisionChange key={`${change.kind}-${change.field}-${index}`} change={change} />
          ))}
        </ul>
      )}
    </li>
  );
}
