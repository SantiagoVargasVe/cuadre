import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { signSessionToken } from "../auth/jwt";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
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
