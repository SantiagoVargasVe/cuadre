import { z } from "zod";

/** Shared with the frontend (T014) so the register form validates identically to the API. */
export const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  // 8 is OWASP's minimum baseline when hashing is done properly (Argon2id
  // here) — no exact number is mandated in docs/context/security.md.
  password: z.string().min(8),
  inviteCode: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
