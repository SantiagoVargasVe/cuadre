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

  /** One caller (the systemd timer) with the one correct token; a generous burst still catches a misbehaving retry loop. */
  fxRefresh: { capacity: 5, windowSeconds: HOUR },

  /**
   * `POST /api/auth/forgot-password`. Consumed per IP *and* per hashed
   * address (T122): the IP bucket stops a spray across many accounts, the
   * address bucket stops mailbombing one person's inbox, and neither
   * substitutes for the other. ~3/hour is well above a real person's
   * "did it arrive? try again" rate.
   */
  passwordResetRequest: { capacity: 3, windowSeconds: HOUR },

  /**
   * `POST /api/auth/reset-password`, per IP. Against 256 bits of token
   * entropy this isn't stopping a guess — it's stopping CPU burn on the
   * Argon2 rehash the consume path does.
   */
  passwordResetConsume: { capacity: 10, windowSeconds: 15 * MINUTE },

  /**
   * `POST /api/auth/verify-email`, per IP. Same shape as
   * `passwordResetConsume`: unauthenticated, consumes a token, and a
   * high-entropy secret makes brute force irrelevant — the limit is there
   * to cap wasted work.
   */
  emailVerifyConsume: { capacity: 10, windowSeconds: 15 * MINUTE },

  /**
   * `POST /api/auth/resend-verification`, per **user** (the caller is
   * authenticated, so their id is a better key than an address). A fresh
   * verification mail on every request would be a mailbomb aimed at the
   * address on file.
   */
  verificationResend: { capacity: 3, windowSeconds: HOUR },
} as const satisfies Record<string, RateLimitPolicy>;
