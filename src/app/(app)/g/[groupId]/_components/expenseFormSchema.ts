import { z } from "zod";

export const expenseFormSchema = z.object({
  title: z.string().trim().min(1),
  amountRaw: z.string().min(1),
  currency: z.string(),
  date: z.string().min(1),
});
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
