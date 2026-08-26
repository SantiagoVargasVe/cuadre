import { z } from "zod";

export const createInviteSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
