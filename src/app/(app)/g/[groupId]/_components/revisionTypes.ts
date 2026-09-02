export interface RevisionActor {
  userId: string;
  displayName: string;
}

export interface RevisionMoney {
  amount: string;
  currency: string;
}

export type RevisionChange =
  | { kind: "text"; field: "title" | "expenseDate" | "splitStrategy" | "currency"; from: string; to: string }
  | { kind: "money"; field: "totalAmount"; from: RevisionMoney; to: RevisionMoney }
  | {
      kind: "party";
      field: "payers" | "splits";
      userId: string;
      displayName: string | null;
      change: "added" | "removed" | "changed";
      from: RevisionMoney | null;
      to: RevisionMoney | null;
    };

/** Mirrors GET /api/expenses/:id/revisions; diffs have already been computed server-side. */
export interface ExpenseRevision {
  version: number;
  action: "created" | "updated" | "deleted";
  changedAt: string;
  changedBy: RevisionActor | null;
  changes: RevisionChange[];
}

export interface ExpenseRevisionsResult {
  revisions: ExpenseRevision[];
}
