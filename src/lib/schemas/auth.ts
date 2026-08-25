import { z } from "zod";
import { es } from "../i18n/es";

const v = es.auth.validation;

/**
 * Shared verbatim with the API (T011) and the register form (T014) — one
 * schema, so client-side validation can never disagree with what the
 * server will actually accept. The error messages are Spanish because
 * react-hook-form's resolver surfaces them directly in the UI; the API
 * itself ignores this schema's messages and returns its own generic 400,
 * so embedding them here costs the server nothing.
 */
export const registerSchema = z.object({
  email: z.string().email(v.emailInvalid),
  displayName: z.string().min(1, v.displayNameRequired).max(200),
  // 8 is OWASP's minimum baseline when hashing is done properly (Argon2id
  // here) — no exact number is mandated in docs/context/security.md.
  password: z.string().min(8, v.passwordTooShort),
  inviteCode: z.string().min(1, v.inviteCodeRequired),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(v.emailInvalid),
  password: z.string().min(1, v.passwordTooShort),
});
export type LoginInput = z.infer<typeof loginSchema>;
