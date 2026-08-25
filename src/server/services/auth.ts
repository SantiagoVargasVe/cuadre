import "server-only";
import { eq } from "drizzle-orm";
import { db, withTransaction } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { signSessionToken } from "../auth/jwt";
import { consumeInvite } from "./invites";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

/** The unique violation on users.email — never revealed via a pre-flight SELECT, just caught here. */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email is already registered");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * drizzle-orm wraps the driver's error in its own DrizzleQueryError, with
 * the real postgres.js PostgresError (the one carrying the SQLSTATE code)
 * attached via `.cause` — confirmed empirically, not documented anywhere
 * obvious. Checking `error.code` alone silently never matches.
 */
function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  return pgErrorCode((error as { cause?: unknown }).cause);
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === UNIQUE_VIOLATION;
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
  return { user: { id: user.id, email: user.email, displayName: user.displayName }, token };
}

/** Used by GET /api/auth/me once a session has already resolved a userId. */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ? { id: user.id, email: user.email, displayName: user.displayName } : null;
}

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
  inviteCode: string;
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

    const { groupId } = await consumeInvite(tx, input.inviteCode, created.id);

    if (groupId) {
      // TODO(T020): insert the group_members row here once that table
      // exists. Until then, a group-carrying code registers the user but
      // does not add the membership — see T011's PR for the reasoning;
      // T020 must close this gap as part of standing up group_members.
    }

    return created;
  });

  const token = await signSessionToken(user.id);
  return { user: { id: user.id, email: user.email, displayName: user.displayName }, token };
}
