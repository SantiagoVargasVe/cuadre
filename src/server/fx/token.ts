import { createHash, timingSafeEqual } from "node:crypto";

/**
 * SHA-256 first, then `timingSafeEqual` on the fixed-length digests —
 * `timingSafeEqual` itself throws on a length mismatch, which a naive
 * `a.length === b.length && timingSafeEqual(a, b)` would leak through its
 * own early return. Hashing first normalizes both inputs to the same
 * length before any comparison happens, so there's nothing to leak.
 */
export function timingSafeTokenEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/**
 * A stable, non-reversible key for rate-limiting by token — the raw
 * secret never has to be written anywhere (security.md § Secrets: "rate
 * limit keys never appear in logs").
 */
export function hashTokenForRateLimit(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
