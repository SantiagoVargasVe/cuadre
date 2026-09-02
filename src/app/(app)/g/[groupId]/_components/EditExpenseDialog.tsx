"use client";

import * as React from "react";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { ExpenseForm } from "./ExpenseForm";
import type { ExpenseDetailResult, ExpenseSummary, GroupMember } from "./types";

const t = es.expenseFeed;

export interface EditExpenseDialogProps {
  expenseId: string;
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  onUpdated: (expense: ExpenseSummary) => void;
}

/** Loads editor-only split intent on demand. The feed remains one request;
 * the detail endpoint is called only after a member chooses Editar. */
export function EditExpenseDialog({ expenseId, groupId, members, myUserId, onUpdated }: EditExpenseDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [expense, setExpense] = React.useState<ExpenseDetailResult | null>(null);
  const [error, setError] = React.useState(false);

  async function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) return;
    setExpense(null);
    setError(false);
    try {
      setExpense(await apiFetch<ExpenseDetailResult>(`/api/expenses/${expenseId}`));
    } catch {
      setError(true);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={(next) => void changeOpen(next)}>
      <DialogTrigger render={<Button variant="ghost" size="sm" type="button" />}>{t.edit}</DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.editTitle}</DialogTitle>
        {!expense && !error && <p className="mt-4 text-sm text-muted-foreground">{t.editLoading}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{t.editLoadError}</p>}
        {expense && (
          <ExpenseForm
            key={`${expense.id}-${expense.version}`}
            groupId={groupId}
            members={members}
            defaultCurrency={expense.total.currency}
            myUserId={myUserId}
            expense={expense}
            onCancel={() => setOpen(false)}
            onSaved={(saved) => {
              setOpen(false);
              onUpdated(saved);
            }}
          />
        )}
      </DialogContent>
    </DialogRoot>
  );
}
