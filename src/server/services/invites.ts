import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Transaction } from "../db/client";
import { ConflictError } from "../errors";
import { inviteCodes } from "../db/schema";

/** Expired, already-consumed, and never-existed codes are deliberately indistinguishable (security.md). */
export class InvalidInviteError extends ConflictError {
  constructor() {
    super("INVALID_INVITE_CODE", "Invite code is invalid, expired, or already used");
    this.name = "InvalidInviteError";
  }
}

/**
 * Atomically marks an invite code consumed, inside the caller's
 * transaction. The conditional UPDATE — rather than a SELECT to check
 * validity followed by an UPDATE — is what makes this race-safe: two
 * concurrent callers both attempting the same code serialize on Postgres's
 * row lock, and whichever commits second finds zero rows matching its own
 * WHERE clause.
 */
export async function consumeInvite(
  tx: Transaction,
  code: string,
  userId: string,
): Promise<{ groupId: string | null }> {
  const [row] = await tx
    .update(inviteCodes)
    .set({ consumedBy: userId, consumedAt: new Date() })
    .where(
      and(
        eq(inviteCodes.code, code),
        isNull(inviteCodes.consumedAt),
        or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, new Date())),
      ),
    )
    .returning({ groupId: inviteCodes.groupId });

  if (!row) throw new InvalidInviteError();
  return { groupId: row.groupId };
}
