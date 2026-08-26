import { z } from "zod";

const memberId = z.string().uuid();
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code");
// Mirrors src/lib/money/parse.ts's own digits-only check — money is never
// a JSON number (api-contract.md), and this is the shape the wire uses.
const moneyString = z.string().regex(/^[0-9]+$/, "must be a string of digits");

// A fat-fingered year shouldn't be able to produce a feed spanning four
// millennia. 2000–2100 comfortably covers any real trip with wide margin.
const expenseDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
  }, "year must be between 2000 and 2100");

const paidByEntry = z.object({ userId: memberId, amount: moneyString });

const splitSchema = z.discriminatedUnion("strategy", [
  z.object({ strategy: z.literal("equal"), members: z.array(memberId).min(1).optional() }),
  z.object({ strategy: z.literal("equal_subset"), members: z.array(memberId).min(1) }),
  z.object({ strategy: z.literal("shares"), weights: z.record(memberId, z.number().int().min(1)) }),
  z.object({
    strategy: z.literal("percentage"),
    basisPoints: z.record(memberId, z.number().int().min(1).max(10000)),
  }),
  z.object({ strategy: z.literal("exact"), amounts: z.record(memberId, moneyString) }),
  z.object({ strategy: z.literal("loan"), to: memberId }),
]);
export type SplitInput = z.infer<typeof splitSchema>;

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: expenseDate,
  amount: moneyString,
  currency: currencyCode,
  paidBy: z.array(paidByEntry).min(1).optional(),
  split: splitSchema,
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
