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
 * Mint an `email_verify` token and mail it. **Best-effort**: registration
 * must commit whether or not this succeeds — a mail failure that also
 * rolled back an account creation, an invite consumption, and a group
 * membership is the failure this shape prevents (ADR-0002, ADR-0011).
 *
 * Both non-delivery paths **log**, and log differently. Nothing here can
 * tell the caller anything — the route returns the same `204` either way —
 * so the server log is the only evidence that verification is silently
 * disabled, and "not configured" and "the send threw" are different
 * operational problems with different fixes (ADR-0011, ADR-0013). The
 * absence of these two lines is what made a production mail outage
 * invisible on 2026-09-04 (T130, T132).
 *
 * `mintToken` invalidates the user's previous `email_verify` token, so
 * this doubles as the resend primitive.
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  if (!isMailConfigured()) {
    // Deliberately does **not** mint first, which is where this diverges
    // from `requestPasswordReset` — and the divergence is now a decision
    // rather than an accident (T132). A reset token minted without mail is
    // still deliverable: `scripts/reset-link.ts` hands it over. Nothing
    // delivers a verification link, so a token minted here would be a row
    // nobody can ever redeem. The member is not stranded either way —
    // ADR-0013 keeps recovery open to an unverified account precisely
    // through that same operator script.
    console.warn(
      "verification email not sent — mail is not configured; this account stays unverified " +
        "and can only recover with `npm run reset-link`",
      { userId },
    );
    return;
  }

  try {
    const token = await mintToken(db, userId, "email_verify");
    await sendMail({ to: email, ...renderVerifyEmail(`${config.APP_URL}/verify-email/${token}`) });
  } catch (error) {
    console.error("verification email failed to send", {
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
