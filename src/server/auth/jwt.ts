import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config";

/**
 * Session tokens. HS256 with AUTH_SECRET — symmetric is right here because
 * the same service both signs and verifies; asymmetric would only matter
 * if a separate party needed to verify without being able to mint.
 *
 * Claims are `sub`, `iat`, `exp` and nothing else (ADR-0003) — no display
 * name, no email, and no membership list, because membership changes must
 * take effect immediately and a claim baked into a token doesn't.
 */
const ALGORITHM = "HS256";
const TTL = "30d";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.AUTH_SECRET);
}

export interface SessionClaims {
  userId: string;
  /**
   * The JWT `iat`, in whole seconds. T123 compares it against
   * `users.sessions_valid_from` to make a session revocable, so it can no
   * longer be discarded here.
   */
  issuedAt: number;
}

/**
 * `issuedAt` (whole seconds) is only for the one flow that must keep the
 * caller logged in *across* a `sessions_valid_from` bump it triggered
 * (T129 change-password): minting at the wall clock would land `iat` in
 * the revoking second and kill the replacement too. Everywhere else it's
 * omitted and jose stamps "now".
 */
export function signSessionToken(userId: string, issuedAt?: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(TTL)
    .sign(secretKey());
}

/**
 * Returns null for any invalid token — expired, tampered, malformed, wrong
 * algorithm, wrong secret — never throws. Callers treat null as "not
 * logged in", not as an error.
 *
 * `algorithms` is explicit so a token claiming `alg: none` (or any other
 * algorithm) can't be accepted.
 */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] });
    // A token with no `sub`, or no numeric `iat` to position against the
    // account's session epoch, can't resolve to a session.
    if (!payload.sub || typeof payload.iat !== "number") return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null;
  }
}
