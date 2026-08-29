import { z } from "zod";
import { parseAmountInput } from "../../../../../lib/money/format";
import type { CreateSettlementInput } from "../../../../../lib/schemas/settlements";

/**
 * Validates the settle-up form's *raw* fields (a `<MoneyField>` string in
 * major units, a date, a note). The wire schema in
 * `lib/schemas/settlements.ts` validates the *converted* payload; the
 * `bigint` conversion happens once here, at `toCreateInput` — the form
 * boundary (design-system.md § *Forms*).
 *
 * The app is recording a fact, not confirming a suggested payment: **any
 * positive amount is accepted**, including one that doesn't match a plan
 * edge (ADR-0009). The only amount rule is "> 0" — a zero or empty field
 * keeps the save button disabled rather than erroring on submit.
 */
export function settlementFormSchema(currency: string) {
  return z.object({
    toUserId: z.string().min(1),
    amount: z
      .string()
      .min(1)
      .refine((raw) => parseAmountInput(raw, currency) > 0n, { error: "amountNotPositive" }),
    settledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().trim().max(500).optional(),
  });
}

export type SettlementFormValues = z.infer<ReturnType<typeof settlementFormSchema>>;

/** Today as `YYYY-MM-DD` in UTC — the same anchoring `date/format.ts` uses so
 * a viewer east of UTC doesn't default a settlement to "tomorrow". */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Form values + the field's currency → the `POST`/`PATCH` body. */
export function toCreateInput(values: SettlementFormValues, currency: string): CreateSettlementInput {
  return {
    toUserId: values.toUserId,
    amount: parseAmountInput(values.amount, currency).toString(),
    currency,
    settledOn: values.settledOn,
    note: values.note?.trim() ? values.note.trim() : undefined,
  };
}
