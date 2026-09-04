import "server-only";
import { eq } from "drizzle-orm";
import type { AvatarChoice } from "../../lib/avatar";
import { CURRENT_LEGAL_DOCUMENTS } from "../../lib/legal";
import type { RegisterInput, UpdateProfileInput } from "../../lib/schemas/auth";
import type { AvatarChoiceInput } from "../../lib/schemas/avatar";
import { toAvatarChoice } from "../db/avatar";
import { db, withTransaction } from "../db/client";
import { groupMembers, legalAcceptances, users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { signSessionToken } from "../auth/jwt";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors";
import { isUniqueViolation } from "../db/pg-errors";
import { consumeInvite } from "./invites";

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

/** The unique violation on users.email — never revealed via a pre-flight SELECT, just caught here. */
export class EmailAlreadyRegisteredError extends ConflictError {
  constructor() {
    super("EMAIL_ALREADY_REGISTERED", "Email is already registered");
    this.name = "EmailAlreadyRegisteredError";
  }
}

// Computed once, lazily, and reused for every login against an unknown
// email — so verifying against a real user and verifying against no user
// cost the same one Argon2 computation, and a timing side-channel can't
// tell "wrong password" from "no such account" apart.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("no-such-account-timing-parity");
  return dummyHash;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  /** The member's chosen avatar, or `null` for the T107 default (T108). */
  avatar: AvatarChoice | null;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
}

/** Wrong password and unknown email throw the same error (security.md). */
export async function login(email: string, password: string): Promise<LoginResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw new InvalidCredentialsError();

  const token = await signSessionToken(user.id);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: toAvatarChoice(user) },
    token,
  };
}

/** Used by GET /api/auth/me once a session has already resolved a userId. */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user
    ? { id: user.id, email: user.email, displayName: user.displayName, avatar: toAvatarChoice(user) }
    : null;
}

/**
 * A member changes **their own** avatar (T108). The acting `userId` comes
 * from the session at the route boundary, never from the body. `null`
 * resets to the T107 default by clearing all three columns.
 */
export async function updateAvatar(userId: string, choice: AvatarChoiceInput): Promise<AuthUser> {
  const [user] = await db
    .update(users)
    .set({
      avatarVariant: choice?.variant ?? null,
      avatarSeed: choice?.seed ?? null,
      avatarPalette: choice?.palette ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new UnauthorizedError();
  return { id: user.id, email: user.email, displayName: user.displayName, avatar: toAvatarChoice(user) };
}

/**
 * A member changes **their own** display name (T109). The acting `userId`
 * comes from the session at the route boundary, never from the body.
 *
 * Nothing denormalizes this name: every read that shows it — member lists,
 * payer and split rows, settlement history, the "edited by" marker — joins
 * `users.display_name` live, so one UPDATE here is the whole change. (The
 * avatar *seed* is deliberately different: it's `userId`-based so it can't
 * drift, which is why renaming never reshuffles anyone's avatar.)
 */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
  const [user] = await db
    .update(users)
    .set({ displayName: input.displayName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new UnauthorizedError();
  return { id: user.id, email: user.email, displayName: user.displayName, avatar: toAvatarChoice(user) };
}

/**
 * Create the user, consume the invite code, and — when the code carries a
 * group_id — insert the group membership, all in one transaction (ADR-0002):
 * a burned code with no account, or an account with a code that silently
 * failed to burn, are exactly the failures this prevents.
 *
 * The password is hashed before the transaction opens — hashing is pure
 * CPU work with no DB dependency, and there's no reason to hold it open
 * for those ~50-100ms.
 */
export async function register(input: RegisterInput): Promise<LoginResult> {
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new ValidationError("LEGAL_ACKNOWLEDGEMENTS_REQUIRED", "Legal acknowledgements required");
  }
  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (tx) => {
    let created: typeof users.$inferSelect | undefined;
    try {
      [created] = await tx
        .insert(users)
        .values({ email: input.email, displayName: input.displayName, passwordHash })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
    if (!created) throw new Error("Insert into users returned no row");

    await tx.insert(legalAcceptances).values(
      CURRENT_LEGAL_DOCUMENTS.map(({ document, version }) => ({
        userId: created.id,
        document,
        documentVersion: version,
        source: "registration" as const,
      })),
    );

    const { groupId } = await consumeInvite(tx, input.inviteCode, created.id);

    if (groupId) {
      await tx.insert(groupMembers).values({ groupId, userId: created.id, role: "member" });
    }

    return created;
  });

  const token = await signSessionToken(user.id);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: toAvatarChoice(user) },
    token,
  };
}
