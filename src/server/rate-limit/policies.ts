/**
 * Rate limit policies, declared in one place rather than as literals
 * scattered across route handlers. Starting points from
 * docs/context/api-contract.md § Rate limits; tune once there's real
 * traffic.
 */
export interface RateLimitPolicy {
  /** Maximum burst. */
  capacity: number;
  /** Seconds for a bucket to refill from empty to full. */
  windowSeconds: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const policies = {
  /** Argon2 verification costs ~50-100ms of CPU and ~19MB per attempt. */
  login: { capacity: 10, windowSeconds: 15 * MINUTE },

  /** The invite gate stops account creation; this stops the attempts. */
  register: { capacity: 5, windowSeconds: HOUR },

  /** Unauthenticated and looks enumerable even at 16 chars of nanoid (security.md). */
  inviteLookup: { capacity: 20, windowSeconds: 10 * MINUTE },
} as const satisfies Record<string, RateLimitPolicy>;
