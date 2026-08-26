import { describe, expect, it } from "vitest";
import { hashTokenForRateLimit, timingSafeTokenEqual } from "./token";

describe("timingSafeTokenEqual", () => {
  it("returns true for identical tokens", () => {
    expect(timingSafeTokenEqual("correct-token", "correct-token")).toBe(true);
  });

  it("returns false for different tokens of the same length", () => {
    expect(timingSafeTokenEqual("correct-token", "wrong-token-!")).toBe(false);
  });

  it("returns false for tokens of different lengths, without throwing", () => {
    expect(() => timingSafeTokenEqual("short", "a-much-longer-token-value")).not.toThrow();
    expect(timingSafeTokenEqual("short", "a-much-longer-token-value")).toBe(false);
  });
});

describe("hashTokenForRateLimit", () => {
  it("is stable for the same token", () => {
    expect(hashTokenForRateLimit("my-token")).toBe(hashTokenForRateLimit("my-token"));
  });

  it("differs for different tokens", () => {
    expect(hashTokenForRateLimit("token-a")).not.toBe(hashTokenForRateLimit("token-b"));
  });

  it("never returns the raw token", () => {
    expect(hashTokenForRateLimit("my-secret-token")).not.toContain("my-secret-token");
  });
});
