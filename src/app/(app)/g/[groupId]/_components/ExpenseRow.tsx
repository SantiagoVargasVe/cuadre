"use client";

import { formatCalendarDate, formatTimestamp } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { Money } from "../../../../_ui/Money";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../../../../_ui/Dialog";
import { ExpenseDetail } from "./ExpenseDetail";
import { resolveDisplayAmounts, wireToMoney, type ExpenseParty } from "./types";
import type { ExpenseSummary } from "./types";

const t = es.expenseFeed;

function paidByLabel(payers: ExpenseParty[], myUserId: string): string {
  if (payers.length > 1) return t.paidByMultiple(payers.length);
  const [payer] = payers;
  if (!payer) return "";
  return payer.userId === myUserId ? t.paidByYou : t.paidBy(payer.displayName);
}

/** One feed row (T063). The full split breakdown in the detail Dialog uses
 * data already on this row — `payers`/`splits` are complete arrays from
 * the list endpoint, so tapping a row never triggers a second fetch. */
export function ExpenseRow({ expense, myUserId }: { expense: ExpenseSummary; myUserId: string }) {
  const display = resolveDisplayAmounts(expense);
  const yourSplit = display.splits.find((split) => split.userId === myUserId);

  return (
    <DialogRoot>
      <DialogTrigger
        className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        render={<button type="button" />}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{expense.title}</span>
          <Money value={display.total} converted={display.convertedFrom} className="font-medium" />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {formatCalendarDate(expense.date)} · {paidByLabel(display.payers, myUserId)}
          </span>
          {yourSplit && (
            <span>
              {t.yourShare}: <Money value={wireToMoney({ amount: yourSplit.amount, currency: display.currency })} />
            </span>
          )}
        </div>
        {expense.editedAt && (
          <span className="text-xs text-muted-foreground">
            {expense.editedBy
              ? t.editedBy(expense.editedBy.displayName, formatTimestamp(expense.editedAt))
              : t.editedUnknown(formatTimestamp(expense.editedAt))}
          </span>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{expense.title}</DialogTitle>
        <ExpenseDetail expense={expense} />
      </DialogContent>
    </DialogRoot>
  );
}
