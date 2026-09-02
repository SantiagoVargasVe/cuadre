import { formatAmountInputValue } from "../../../../../lib/money/format";
import type { ExpenseFormValues } from "./expenseFormSchema";
import { todayIso } from "./expenseFormSchema";
import type { Payer } from "./PayerEditor";
import type { ExpenseDetailResult } from "./types";

export function expenseFormDefaults(
  expense: ExpenseDetailResult | undefined,
  defaultCurrency: string,
): ExpenseFormValues {
  if (!expense) return { title: "", amountRaw: "", currency: defaultCurrency, date: todayIso() };
  return {
    title: expense.title,
    amountRaw: formatAmountInputValue(BigInt(expense.total.amount), expense.total.currency),
    currency: expense.total.currency,
    date: expense.date,
  };
}

export function expensePayerDefaults(expense: ExpenseDetailResult | undefined): Payer[] | null {
  return expense?.payers.map((payer) => ({ userId: payer.userId, amount: BigInt(payer.amount) })) ?? null;
}
