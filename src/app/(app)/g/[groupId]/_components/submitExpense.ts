import { apiFetch } from "../../../../../lib/api/client";
import { parseAmountInput } from "../../../../../lib/money/format";
import type { SplitInput } from "../../../../../lib/schemas/expenses";
import type { ExpenseFormValues } from "./expenseFormSchema";
import type { Payer } from "./PayerEditor";
import type { ExpenseSummary } from "./types";

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
): Promise<ExpenseSummary> {
  const amount = parseAmountInput(data.amountRaw, data.currency);
  const created = await apiFetch<{ id: string }>(`/api/groups/${groupId}/expenses`, {
    method: "POST",
    body: {
      title: data.title,
      date: data.date,
      amount: amount.toString(),
      currency: data.currency,
      ...(payers ? { paidBy: payers.map((p) => ({ userId: p.userId, amount: p.amount.toString() })) } : {}),
      split,
    },
  });
  return apiFetch<ExpenseSummary>(`/api/expenses/${created.id}`);
}
