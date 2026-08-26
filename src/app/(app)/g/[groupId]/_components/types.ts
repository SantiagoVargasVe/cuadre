/**
 * Mirrors `ExpenseSummary`/`ExpenseListResult` (server/services/expenses.ts)
 * — the wire shape from `GET /api/groups/:id/expenses` and
 * `GET /api/expenses/:id` (api-contract.md § *Reading a list or a single
 * expense*). Declared here rather than imported: `src/app/` never imports
 * from `src/server/` (frontend/CLAUDE.md § *The hard rule*), types included.
 */
export interface ExpenseParty {
  userId: string;
  amount: string;
  displayName: string;
}

export interface ConvertedAmounts {
  total: { amount: string; currency: string };
  payers: ExpenseParty[];
  splits: ExpenseParty[];
}

export interface EditedBy {
  userId: string;
  displayName: string;
}

export interface ExpenseSummary {
  id: string;
  title: string;
  date: string;
  total: { amount: string; currency: string };
  payers: ExpenseParty[];
  splits: ExpenseParty[];
  strategy: string;
  converted: ConvertedAmounts | null;
  editedAt: string | null;
  editedBy: EditedBy | null;
}

export interface ExpenseListResult {
  items: ExpenseSummary[];
  nextCursor: string | null;
}

/** Wire money (`{ amount: string }`) → `<Money>`'s `{ amount: bigint }` —
 * the one conversion point for rows/details built from this feed's data. */
export function wireToMoney(wire: { amount: string; currency: string }): {
  amount: bigint;
  currency: string;
} {
  return { amount: BigInt(wire.amount), currency: wire.currency };
}

export interface DisplayAmounts {
  currency: string;
  payers: ExpenseParty[];
  splits: ExpenseParty[];
  total: { amount: bigint; currency: string };
  convertedFrom?: { original: { amount: bigint; currency: string }; pinnedAt: string };
}

/**
 * Picks the converted figures over the original ones, everywhere at
 * once — total, payers, and splits together — when the group has a
 * display currency. `<Money>`'s `converted` marker on the total then
 * communicates that the whole row (including "your share") is a
 * converted view, per design-system.md § *Money display*: "an
 * unlabelled converted number is a trust bug." The one place `ExpenseRow`
 * and `ExpenseDetail` both read from, so they can't disagree about which
 * currency a given expense is showing.
 */
export function resolveDisplayAmounts(expense: ExpenseSummary): DisplayAmounts {
  if (!expense.converted) {
    return {
      currency: expense.total.currency,
      payers: expense.payers,
      splits: expense.splits,
      total: wireToMoney(expense.total),
    };
  }
  return {
    currency: expense.converted.total.currency,
    payers: expense.converted.payers,
    splits: expense.converted.splits,
    total: wireToMoney(expense.converted.total),
    convertedFrom: { original: wireToMoney(expense.total), pinnedAt: expense.date },
  };
}
