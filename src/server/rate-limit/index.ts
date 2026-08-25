import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { RateLimitError } from "../errors";
import type { RateLimitPolicy } from "./policies";

/**
 * Token-bucket rate limiting, stored in Postgres (data-model.md §
 * rate_limits — same design as the sibling wishlist app's limiter).
 *
 * A bucket holds up to `capacity` tokens and refills continuously at
 * `capacity / windowSeconds` per second. Each request spends one. Token
 * bucket rather than a fixed window because a fixed window lets a client
 * spend its whole quota at the end of one window and again at the start of
 * the next — twice the intended burst — and it synchronises clients into
 * herds at each boundary.
 */

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export async function consume(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  const refillPerSecond = policy.capacity / policy.windowSeconds;

  try {
    // One statement, deliberately. A read-then-write lets two concurrent
    // requests both observe the last token and both take it — exactly the
    // failure a rate limiter exists to prevent.
    //
    // The WHERE on DO UPDATE is what makes rejection safe: when the bucket
    // is empty the update is skipped entirely, so updated_at is NOT
    // advanced. Advancing it would restart the refill clock on every
    // rejected request, and a client hammering the endpoint would never
    // recover.
    const rows = await db.execute<{ tokens: string }>(sql`
      INSERT INTO rate_limits (key, tokens, updated_at)
      VALUES (${key}, ${policy.capacity - 1}::numeric, now())
      ON CONFLICT (key) DO UPDATE SET
        tokens = LEAST(
          ${policy.capacity}::numeric,
          rate_limits.tokens
            + EXTRACT(EPOCH FROM (now() - rate_limits.updated_at))::numeric * ${refillPerSecond}::numeric
        ) - 1,
        updated_at = now()
      WHERE LEAST(
        ${policy.capacity}::numeric,
        rate_limits.tokens
          + EXTRACT(EPOCH FROM (now() - rate_limits.updated_at))::numeric * ${refillPerSecond}::numeric
      ) >= 1
      RETURNING tokens
    `);

    const row = rows[0];
    if (row) return { allowed: true, remaining: Math.floor(Number(row.tokens)) };

    // Rejected. One extra read on the slow path to give an honest Retry-After.
    const state = await db.execute<{ available: string }>(sql`
      SELECT LEAST(
        ${policy.capacity}::numeric,
        tokens + EXTRACT(EPOCH FROM (now() - updated_at))::numeric * ${refillPerSecond}::numeric
      ) AS available
      FROM rate_limits WHERE key = ${key}
    `);

    const available = Number(state[0]?.available ?? 0);
    const secondsToOneToken = Math.max(1, Math.ceil((1 - available) / refillPerSecond));

    return { allowed: false, retryAfterSeconds: secondsToOneToken };
  } catch (error) {
    // Fail open. A rate-limiter outage should not take the site down, and
    // if the database is unreachable the request was going to fail anyway.
    console.error("Rate limit check failed, allowing request:", error);
    return { allowed: true, remaining: -1 };
  }
}

/** Consume a token or throw RateLimitError. What route handlers call. */
export async function requireNotLimited(policy: RateLimitPolicy, key: string): Promise<void> {
  const result = await consume(policy, key);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}
