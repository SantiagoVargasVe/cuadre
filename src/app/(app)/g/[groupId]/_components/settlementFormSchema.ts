import { z } from "zod";
import { parseAmountInput } from "../../../../../lib/money/format";
import type { CreateSettlementInput } from "../../../../../lib/schemas/settlements";

/**
 * Validates the settle-up form's *raw* fields (a `<MoneyField>` string in
 * major units, a currency, a date, a note). The wire schema in
 * `lib/schemas/settlements.ts` validates the *converted* payload; the
 * `bigint` conversion happens once, at `toCreateInput` — the form
 * boundary (design-system.md § *Forms*).
 *
 * `currency` is a field now (T104): the form has a currency select, so
 * "is the amount > 0" has to be checked against whatever currency is
 * currently chosen — the object-level refine reads `v.currency`.
 *
 * The app is recording a fact, not confirming a suggested payment: **any
 * positive amount is accepted**, including one that doesn't match a plan
 * edge (ADR-0009). The only amount rule is "> 0".
 */
export function settlementFormSchema() {
  return z
    .object({
      toUserId: z.string().min(1),
      currency: z.string().regex(/^[A-Z]{3}$/),
      amount: z.string().min(1),
      settledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().trim().max(500).optional(),
    })
    .refine(
      (v) => {
        try {
          return parseAmountInput(v.amount, v.currency) > 0n;
        } catch {
          // An unknown currency is already caught by the field's own regex —
          // don't let it throw out of the object refine.
          return false;
        }
      },
      { error: "amountNotPositive", path: ["amount"] },
    );
}

export type SettlementFormValues = z.infer<ReturnType<typeof settlementFormSchema>>;

/** Today as `YYYY-MM-DD` in UTC — the same anchoring `date/format.ts` uses so
 * a viewer east of UTC doesn't default a settlement to "tomorrow". */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Form values → the `POST`/`PATCH` body. The currency is now on `values`. */
export function toCreateInput(values: SettlementFormValues): CreateSettlementInput {
  return {
    toUserId: values.toUserId,
    amount: parseAmountInput(values.amount, values.currency).toString(),
    currency: values.currency,
    settledOn: values.settledOn,
    note: values.note?.trim() ? values.note.trim() : undefined,
  };
}
