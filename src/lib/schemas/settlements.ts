import { z } from "zod";

const memberId = z.string().uuid();
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code");
// Mirrors src/lib/money/parse.ts's own digits-only check — money is never
// a JSON number (api-contract.md), and this is the shape the wire uses.
const moneyString = z.string().regex(/^[0-9]+$/, "must be a string of digits");

// Same bounds and reasoning as expenses' expenseDate (lib/schemas/expenses.ts).
const settledOn = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
  }, "year must be between 2000 and 2100");

export const createSettlementSchema = z.object({
  toUserId: memberId,
  amount: moneyString,
  currency: currencyCode,
  settledOn,
  note: z.string().trim().max(500).optional(),
});
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;

// PATCH replaces the whole settlement, same "no partial patch" rule as
// expenses — resolving a half-updated amount against a stale currency is
// not a state anyone should have to reason about. `toUserId` may change
// (fixing a typo'd recipient) but `fromUserId` never — see services/settlements.ts.
export const updateSettlementSchema = createSettlementSchema;
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>;
