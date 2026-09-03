import { describe, expect, it } from "vitest";
import {
  LIVE_MAX_POLLED_PAGES,
  LIVE_REFRESH_INTERVAL_MS,
  LIVE_STALE_TIME_MS,
  liveGroupRead,
  livePollInterval,
} from "./liveGroupQuery";

/**
 * These read like tautologies and aren't: each one pins a property the
 * policy depends on, and every one of them was violated by the code this
 * replaced.
 */
describe("liveGroupRead", () => {
  it("keeps staleTime finite, so focus refetch works and fresh initialData wins", () => {
    expect(Number.isFinite(liveGroupRead.staleTime)).toBe(true);
    expect(liveGroupRead.staleTime).toBe(LIVE_STALE_TIME_MS);
  });

  it("becomes stale before the next poll, so a returning tab refreshes on focus", () => {
    expect(LIVE_STALE_TIME_MS).toBeLessThan(LIVE_REFRESH_INTERVAL_MS);
  });

  it("polls on an interval, and leaves background refetching off by default", () => {
    expect(liveGroupRead.refetchInterval).toBe(LIVE_REFRESH_INTERVAL_MS);
    expect(liveGroupRead).not.toHaveProperty("refetchIntervalInBackground");
  });
});

describe("livePollInterval", () => {
  it("polls a feed that is one page deep — the case every real group is in", () => {
    expect(livePollInterval(1)).toBe(LIVE_REFRESH_INTERVAL_MS);
  });

  it("still polls up to the cap, so one request per tick stays one request", () => {
    expect(livePollInterval(LIVE_MAX_POLLED_PAGES)).toBe(LIVE_REFRESH_INTERVAL_MS);
  });

  it("stops polling once someone has paged deep into history", () => {
    expect(livePollInterval(LIVE_MAX_POLLED_PAGES + 1)).toBe(false);
    expect(livePollInterval(20)).toBe(false);
  });
});
