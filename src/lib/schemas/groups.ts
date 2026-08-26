import { z } from "zod";

const title = z.string().trim().min(1).max(200);
const description = z.string().max(2000);
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code");

export const createGroupSchema = z.object({
  title,
  description: description.optional(),
  defaultCurrency: currencyCode.optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  simplifyDebts: z.boolean().optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const setDisplayCurrencySchema = z.object({ currency: currencyCode });
export type SetDisplayCurrencyInput = z.infer<typeof setDisplayCurrencySchema>;
