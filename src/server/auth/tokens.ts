import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db, Transaction } from "../db/client";
import { authTokens } from "../db/schema";
import { InvalidAuthTokenError } from "../errors";

/**
 * Mint and consume for the shared `auth_tokens` table (E15). Both halves
 * of ADR-0012 and ADR-0013 with **no HTTP and no email** — the reset
 * endpoints (T125), the verify endpoints (T124), and the operator script
 * (T128) all sit on these two functions so they cannot drift apart.
 *
 * **No `import "server-only"`.** `scripts/reset-link.ts` runs outside
 * Next, and the alternative — a second `mint` implementation in the script
 * — is exactly what a shared table exists to avoid. Anything that needs
 * `password.ts` (which is `server-only`) composes on top in
 * `services/password-reset.ts`.
 *
 * Only the SHA-256 of a token is ever stored or looked up. That is not
 * Argon2id: a 32-byte CSPRNG secret isn't guessable at any per-attempt
 * cost, so a memory-hard hash would add ~100 ms and ~19 MB per lookup for
 * nothing (ADR-0012 § Why SHA-256).
 */

export type AuthTokenPurpose = "password_reset" | "email_verify";

/**
 * Expiry per purpose, as named constants rather than literals at call
 * sites. A verification mail sitting in an inbox overnight is normal; a
 * reset link sitting overnight is not.
 */
export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  password_reset: 30 * 60_000, // 30 minutes
  email_verify: 24 * 60 * 60_000, // 24 hours
};

const TOKEN_BYTES = 32;

/** The SHA-256 (hex) of a plaintext token — the only representation persisted or queried. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mint a token for `userId` / `purpose`. Returns the **plaintext exactly
 * once**; only its hash is stored. Minting invalidates the user's other
 * outstanding tokens **of the same purpose** and leaves the other purpose
 * untouched — someone mid-verification who asks for a reset must not lose
 * either.
 *
 * `SELECT … FOR UPDATE` on the user row serializes concurrent mints for
 * one account, so "invalidate siblings, then insert" can't interleave into
 * two live tokens.
 */
export async function mintToken(
  db: Db,
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    await deleteUserTokens(tx, userId, purpose);
    await tx.insert(authTokens).values({ tokenHash, userId, purpose, expiresAt });
  });

  return token;
}

/**
 * Claim a token for `purpose` in a **single** conditional
 * `UPDATE … RETURNING`, exactly like `consumeInvite`. A read-then-write
 * would let two concurrent requests both observe an unused token.
 *
 * `purpose` is part of the `WHERE`, never a check afterwards: a
 * verification token honoured by the reset path would let anyone who can
 * read a verification mail set a password (ADR-0013). Invalid, expired,
 * used, unknown, and wrong-purpose all raise one `InvalidAuthTokenError`.
 *
 * Takes a `Transaction` because every caller composes it with a `users`
 * write in the same commit (`services/password-reset.ts`).
 */
export async function consumeToken(
  tx: Transaction,
  token: string,
  purpose: AuthTokenPurpose,
): Promise<{ userId: string }> {
  const [row] = await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokens.userId });

  if (!row) throw new InvalidAuthTokenError();
  return { userId: row.userId };
}

/**
 * Delete every remaining token of one purpose for a user. Called after a
 * successful reset or password change so a live reset link doesn't sit in
 * an inbox once the password is already known (T125, T129) — and by
 * `mintToken` to invalidate siblings before issuing a fresh one.
 */
export async function deleteUserTokens(
  tx: Transaction,
  userId: string,
  purpose: AuthTokenPurpose,
): Promise<void> {
  await tx
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
}
