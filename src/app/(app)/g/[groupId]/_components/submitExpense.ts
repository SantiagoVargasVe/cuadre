import { apiFetch } from "../../../../../lib/api/client";
import type { ExpenseCategoryKey } from "../../../../../lib/categories";
import { parseAmountInput } from "../../../../../lib/money/format";
import type { SplitInput } from "../../../../../lib/schemas/expenses";
import type { ExpenseFormValues } from "./expenseFormSchema";
import type { Payer } from "./PayerEditor";
import type { ExpenseDetailResult, ExpenseSummary } from "./types";

/**
 * Creates the expense, then fetches it back by id rather than
 * reconstructing a row from the `POST` response and the form's own
 * state — the list and detail endpoints share a shape (api-contract.md §
 * *Reading a list or a single expense*), so this is what keeps the form
 * "never optimistic": the record handed back is exactly what the server
 * resolved, never a guess.
 */
export async function submitExpense(
  groupId: string,
  data: ExpenseFormValues,
  payers: Payer[] | null,
  split: SplitInput,
  category: ExpenseCategoryKey | null,
  expenseId?: string,
): Promise<ExpenseSummary> {
  const amount = parseAmountInput(data.amountRaw, data.currency);
  const paidBy = payers?.map((payer) => ({
    userId: payer.userId,
    amount: (payers.length === 1 ? amount : payer.amount).toString(),
  }));
  const saved = await apiFetch<{ id: string }>(
    expenseId ? `/api/expenses/${expenseId}` : `/api/groups/${groupId}/expenses`,
    {
      method: expenseId ? "PATCH" : "POST",
      body: {
        title: data.title,
        date: data.date,
        amount: amount.toString(),
        currency: data.currency,
        ...(paidBy ? { paidBy } : {}),
        split,
        ...(expenseId || category ? { category } : {}),
      },
    },
  );
  return apiFetch<ExpenseDetailResult>(`/api/expenses/${saved.id}`);
}
