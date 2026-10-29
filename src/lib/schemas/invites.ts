import { z } from "zod";

// Group-link lifetime is owned by the server (ADR-0014).
export const createInviteSchema = z.strictObject({});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
