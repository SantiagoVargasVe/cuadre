"use client";

import * as React from "react";
import { es } from "../../../../../lib/i18n/es";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { ExpenseForm } from "./ExpenseForm";
import type { ExpenseSummary, GroupMember } from "./types";

const t = es.expenseFeed;

export interface AddExpenseFabProps {
  groupId: string;
  members: GroupMember[];
  defaultCurrency: string;
  myUserId: string;
  onCreated: (expense: ExpenseSummary) => void;
}

/**
 * "The single most-used control in the app and it does not scroll away"
 * (design-system.md § *Layout*) — fixed bottom-right, reachable one-handed.
 * Controlled so a successful submit (ExpenseForm) can close it itself.
 */
export function AddExpenseFab({ groupId, members, defaultCurrency, myUserId, onCreated }: AddExpenseFabProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t.addExpense}
        render={<button type="button" />}
      >
        <PlusIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.addExpense}</DialogTitle>
        <ExpenseForm
          groupId={groupId}
          members={members}
          defaultCurrency={defaultCurrency}
          myUserId={myUserId}
          onSaved={(expense) => {
            onCreated(expense);
            setOpen(false);
          }}
        />
      </DialogContent>
    </DialogRoot>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
