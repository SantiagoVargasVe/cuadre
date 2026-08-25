import "server-only";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./cookie";
import { verifySessionToken } from "./jwt";

/** Thrown by requireUserId() when there's no valid session. T013 folds this into the formal UnauthorizedError. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export interface Session {
  userId: string;
}

/**
 * Reads the session from either the `cuadre_session` cookie or an
 * `Authorization: Bearer` header (ADR-0003) — one function, so nothing
 * downstream knows which source was used. Returns null for absent,
 * expired, tampered, or malformed tokens alike.
 */
export async function getSession(request: NextRequest): Promise<Session | null> {
  const token = bearerToken(request) ?? request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  return claims ? { userId: claims.userId } : null;
}

/**
 * Same as getSession, but throws when there's no session. Route handlers
 * that require auth call this first.
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError();
  return session.userId;
}
