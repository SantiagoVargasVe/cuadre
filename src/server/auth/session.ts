import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "../db/client";
import { users } from "../db/schema";
import { UnauthorizedError } from "../errors";
import { SESSION_COOKIE_NAME } from "./cookie";
import { verifySessionToken, type SessionClaims } from "./jwt";

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export interface Session {
  userId: string;
}

/**
 * Turns verified token claims into a live session, or null. This is the
 * step that makes a JWT revocable (ADR-0012): one indexed read of
 * `users.sessions_valid_from`, then `iat >= sessions_valid_from`. A token
 * minted before the account's session epoch — after a password reset or
 * change — resolves to null even though its signature is still valid.
 *
 * The comparison is plain integer seconds with no rounding: `iat` is whole
 * seconds and T119 stores `sessions_valid_from` truncated to the second,
 * so a token issued *in* the revoking second is invalid and one issued in
 * the next second is valid. A missing user row is "not logged in", not a
 * 500.
 *
 * Exactly one DB read per call, and nothing caches it — a cache here would
 * reintroduce the staleness this removes.
 */
async function resolveSession(claims: SessionClaims | null): Promise<Session | null> {
  if (!claims) return null;

  const [row] = await db
    .select({ sessionsValidFrom: users.sessionsValidFrom })
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);
  if (!row) return null;

  const validFromSeconds = Math.floor(row.sessionsValidFrom.getTime() / 1000);
  if (claims.issuedAt < validFromSeconds) return null;

  return { userId: claims.userId };
}

/**
 * Reads the session from either the `cuadre_session` cookie or an
 * `Authorization: Bearer` header (ADR-0003) — one function, so nothing
 * downstream knows which source was used — then checks it hasn't been
 * revoked. Returns null for absent, expired, tampered, malformed, **or
 * revoked** tokens alike.
 *
 * Not called from `src/middleware.ts`: that runs on the Edge runtime where
 * the pg driver can't follow, and stays a crypto-only redirect gate.
 */
export async function getSession(request: NextRequest): Promise<Session | null> {
  const token = bearerToken(request) ?? request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveSession(await verifySessionToken(token));
}

/**
 * Same as getSession, but throws UnauthorizedError when there's no live
 * session. Route handlers that require auth call this first. It delegates
 * to getSession, so there is still exactly one DB read.
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError();
  return session.userId;
}

/**
 * Cookie-only variant for Server Components (the `/` redirect), which read
 * via next/headers' cookies() rather than a NextRequest. Applies the same
 * revocation check — a revoked session must not be bounced to `/groups`.
 */
export async function getSessionFromCookies(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveSession(await verifySessionToken(token));
}
