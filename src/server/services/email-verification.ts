import "server-only";
import { eq } from "drizzle-orm";
import { config } from "../config";
import { mintToken } from "../auth/tokens";
import { db } from "../db/client";
import { users } from "../db/schema";
import { UnauthorizedError } from "../errors";
import { isMailConfigured, sendMail } from "../mail";
import { renderVerifyEmail } from "../mail/templates/verify-email";

/**
 * The working half of ADR-0013: registration mails a verification link,
 * and a token exchange (`markEmailVerified`, from T122) marks the address
 * verified. **Verification gates nothing but self-service password reset**
 * — not login, not the invite/join flow, not any other endpoint.
 *
 * Reuses T122's `mintToken` / `markEmailVerified`; there is no second
 * consume statement here.
 */

/**
 * Mint an `email_verify` token and mail it. **Best-effort**: if mail is
 * unconfigured the whole thing is a no-op, and a send failure is logged
 * (recipient domain only, in `sendMail`) and swallowed. Registration must
 * commit whether or not this succeeds — a mail failure that also rolled
 * back an account creation, an invite consumption, and a group membership
 * is the failure this shape prevents (ADR-0002, ADR-0011).
 *
 * `mintToken` invalidates the user's previous `email_verify` token, so
 * this doubles as the resend primitive.
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  if (!isMailConfigured()) return;
  try {
    const token = await mintToken(db, userId, "email_verify");
    await sendMail({ to: email, ...renderVerifyEmail(`${config.APP_URL}/verify-email/${token}`) });
  } catch (error) {
    console.error("verification email failed", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * `POST /api/auth/resend-verification`. Sends a fresh link for the
 * caller's own address. Already-verified accounts send nothing but still
 * return `204` from the route — the caller learns nothing about their own
 * account they didn't already know.
 */
export async function resendVerification(userId: string): Promise<void> {
  const [user] = await db
    .select({ email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new UnauthorizedError();
  if (user.emailVerifiedAt) return;

  await sendVerificationEmail(userId, user.email);
}
