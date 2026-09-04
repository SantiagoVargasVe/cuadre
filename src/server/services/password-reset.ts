import "server-only";
import { eq, sql } from "drizzle-orm";
import { config } from "../config";
import { db, withTransaction } from "../db/client";
import { users } from "../db/schema";
import { hashPassword } from "../auth/password";
import { consumeToken, deleteUserTokens, mintToken } from "../auth/tokens";
import { isMailConfigured, sendMail } from "../mail";
import { renderPasswordResetEmail } from "../mail/templates/password-reset";

/**
 * The `server-only` half of E15's token flows — the pieces that need
 * `password.ts` or must move `users.sessions_valid_from`, composed on top
 * of `auth/tokens.ts`. Kept out of `auth/tokens.ts` so that module stays
 * runnable outside Next for `scripts/reset-link.ts` (T128).
 *
 * `markEmailVerified` lives here too rather than in its own file: it is
 * the same shape — claim a token, write one `users` column, one
 * transaction — and T124 builds its endpoints on it.
 */

/** Domain only, for the distinct-log requirement below — never the address itself. */
function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1) || "(none)";
}

/**
 * The domain half of `POST /api/auth/forgot-password`. **Returns nothing
 * observable** — the route sends an identical `202` on every path, so any
 * branch a client could see is an account-enumeration oracle (ADR-0012).
 *
 * Four outcomes, and the only place they differ is the server log — per
 * ADR-0013 that log is the sole diagnostic for this whole flow, so each
 * line is distinct. Never logs the address (domain at most) or the token.
 *
 *  1. Unknown address → no token, no mail.
 *  2. **Unverified address → no token, no mail.** This is the gate: a link
 *     mailed to a mistyped address goes to whoever owns the typo, and this
 *     endpoint is public.
 *  3. Verified, mail unconfigured → token minted, not delivered; the
 *     operator hands it over with `scripts/reset-link.ts` (ADR-0011).
 *  4. Verified, send fails → swallowed. A provider outage must not become
 *     an oracle.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.warn("password reset requested for an address with no account", {
      domain: emailDomain(email),
    });
    return;
  }
  if (!user.emailVerifiedAt) {
    console.warn("password reset requested for an unverified address — no link sent", {
      userId: user.id,
    });
    return;
  }

  const token = await mintToken(db, user.id, "password_reset");

  if (!isMailConfigured()) {
    console.warn(
      "password reset token minted but mail is not configured — deliver it with `npm run reset-link`",
      { userId: user.id },
    );
    return;
  }

  try {
    await sendMail({
      to: email,
      ...renderPasswordResetEmail(`${config.APP_URL}/reset-password/${token}`),
    });
  } catch (error) {
    // Swallowing this is correct, not a bug: telling a caller the send
    // failed tells them the address is registered and verified.
    console.error("password reset email failed to send", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Claim a `password_reset` token and, in the **same transaction**: write
 * the new Argon2id hash, delete the user's remaining `password_reset`
 * tokens, and move `sessions_valid_from` to
 * `date_trunc('second', now()) + 1s` so every session minted earlier
 * stops resolving (ADR-0012). A crash must not leave a spent token with
 * the old password still working.
 *
 * Argon2 runs **before** the transaction opens — ~100 ms and ~19 MB must
 * not pin a pooled connection, exactly as `register` already does.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (tx) => {
    const { userId } = await consumeToken(tx, token, "password_reset");
    await tx
      .update(users)
      .set({
        passwordHash,
        sessionsValidFrom: sql`date_trunc('second', now()) + interval '1 second'`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await deleteUserTokens(tx, userId, "password_reset");
  });
}

/**
 * Claim an `email_verify` token and set `users.email_verified_at` in one
 * transaction. `coalesce` keeps the *first* verification instant if the
 * account is already verified — re-verifying with a still-valid older link
 * is a no-op success, not an error, and the timestamp answers *when* it
 * was first confirmed.
 */
export async function markEmailVerified(token: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { userId } = await consumeToken(tx, token, "email_verify");
    await tx
      .update(users)
      .set({
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });
}
