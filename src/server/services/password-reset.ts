import "server-only";
import { eq, sql } from "drizzle-orm";
import { withTransaction } from "../db/client";
import { users } from "../db/schema";
import { hashPassword } from "../auth/password";
import { consumeToken, deleteUserTokens } from "../auth/tokens";

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
