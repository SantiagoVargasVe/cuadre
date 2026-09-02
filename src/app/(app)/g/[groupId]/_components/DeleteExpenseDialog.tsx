"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";

const t = es.expenseFeed;

export function DeleteExpenseDialog({
  expenseId,
  expenseTitle,
  groupId,
  onDeleted,
}: {
  expenseId: string;
  expenseTitle: string;
  groupId: string;
  onDeleted: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState(false);

  async function remove() {
    setDeleting(true);
    setError(false);
    try {
      await apiFetch<void>(`/api/expenses/${expenseId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      onDeleted(expenseId);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" type="button" />}>{t.delete}</DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.deleteTitle}</DialogTitle>
        <p className="mt-2 text-sm text-foreground">{t.deleteConfirm(expenseTitle)}</p>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{t.deleteError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" disabled={deleting} onClick={() => setOpen(false)}>{t.cancel}</Button>
          <Button variant="destructive" type="button" disabled={deleting} onClick={() => void remove()}>
            {deleting ? t.deleting : t.delete}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
