"use client";

import { DeleteExpenseDialog } from "./DeleteExpenseDialog";
import { EditExpenseDialog } from "./EditExpenseDialog";
import type { ExpenseSummary, GroupMember } from "./types";

export function ExpenseDetailActions({
  expense,
  groupId,
  members,
  myUserId,
  onUpdated,
  onDeleted,
}: {
  expense: ExpenseSummary;
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  onUpdated: (expense: ExpenseSummary) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <div className="mt-4 flex gap-2 border-t border-border pt-4">
      <EditExpenseDialog
        expenseId={expense.id}
        groupId={groupId}
        members={members}
        myUserId={myUserId}
        onUpdated={onUpdated}
      />
      <DeleteExpenseDialog
        expenseId={expense.id}
        expenseTitle={expense.title}
        groupId={groupId}
        onDeleted={onDeleted}
      />
    </div>
  );
}
