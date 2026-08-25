import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb } from "../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const TINY_POLICY = { capacity: 3, windowSeconds: 60 };

describe.skipIf(!hasTestDatabase)("rate-limit token bucket", () => {
  setupTestDb();

  let consume: typeof import("./index").consume;
  let requireNotLimited: typeof import("./index").requireNotLimited;
  let RateLimitExceededError: typeof import("./index").RateLimitExceededError;

  beforeAll(async () => {
    // ./index imports the singleton db (src/server/db/client.ts), which
    // reads config.DATABASE_URL — not DATABASE_URL_TEST. Point it at the
    // same physical database the harness just migrated.
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ consume, requireNotLimited, RateLimitExceededError } = await import("./index"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("allows up to capacity requests, then rejects", async () => {
    const key = `test:${crypto.randomUUID()}`;

    for (let i = 0; i < TINY_POLICY.capacity; i++) {
      const result = await consume(TINY_POLICY, key);
      expect(result.allowed).toBe(true);
    }

    const rejected = await consume(TINY_POLICY, key);
    expect(rejected.allowed).toBe(false);
    if (!rejected.allowed) {
      expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("does not advance the bucket's clock on a rejected request", async () => {
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < TINY_POLICY.capacity; i++) {
      await consume(TINY_POLICY, key);
    }

    const firstRejection = await consume(TINY_POLICY, key);
    const secondRejection = await consume(TINY_POLICY, key);

    expect(firstRejection.allowed).toBe(false);
    expect(secondRejection.allowed).toBe(false);
    if (!firstRejection.allowed && !secondRejection.allowed) {
      // If the rejected attempt had advanced updated_at, the retry window
      // would keep resetting and a hammering client would never recover.
      expect(secondRejection.retryAfterSeconds).toBeLessThanOrEqual(
        firstRejection.retryAfterSeconds,
      );
    }
  });

  it("keeps separate buckets per key", async () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;

    for (let i = 0; i < TINY_POLICY.capacity; i++) {
      await consume(TINY_POLICY, keyA);
    }

    expect((await consume(TINY_POLICY, keyA)).allowed).toBe(false);
    expect((await consume(TINY_POLICY, keyB)).allowed).toBe(true);
  });

  it("requireNotLimited throws RateLimitExceededError once the bucket is empty", async () => {
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < TINY_POLICY.capacity; i++) {
      await requireNotLimited(TINY_POLICY, key);
    }

    await expect(requireNotLimited(TINY_POLICY, key)).rejects.toThrow(RateLimitExceededError);
  });
});
