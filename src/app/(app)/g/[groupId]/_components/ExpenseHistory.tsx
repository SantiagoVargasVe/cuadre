"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { RevisionEntry } from "./RevisionEntry";
import type { ExpenseRevisionsResult } from "./revisionTypes";

const t = es.expenseHistory;

/** Collapsed until requested, so history does not compete with the split breakdown. */
export function ExpenseHistory({ expenseId }: { expenseId: string }) {
  const [open, setOpen] = React.useState(false);
  const query = useQuery({
    queryKey: ["expense", expenseId, "revisions"],
    queryFn: () => apiFetch<ExpenseRevisionsResult>(`/api/expenses/${expenseId}/revisions`),
    enabled: open,
  });

  return (
    <details className="border-t border-border pt-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="min-h-11 content-center text-sm font-medium text-foreground">{t.heading}</summary>
      <div className="pt-3">
        {query.isLoading && <p className="text-sm text-muted-foreground">{t.loading}</p>}
        {query.isError && <p className="text-sm text-muted-foreground">{t.error}</p>}
        {query.data && <ol>{query.data.revisions.map((revision) => <RevisionEntry key={revision.version} revision={revision} />)}</ol>}
      </div>
    </details>
  );
}
