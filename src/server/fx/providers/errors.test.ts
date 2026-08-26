import { describe, expect, it } from "vitest";
import { ProviderRequestFailedError } from "./errors";

describe("ProviderRequestFailedError", () => {
  it("includes the cause's message when it's an Error", () => {
    const error = new ProviderRequestFailedError("https://example.test", new Error("boom"));
    expect(error.message).toContain("boom");
  });

  it("still constructs a sensible message when the cause isn't an Error", () => {
    const error = new ProviderRequestFailedError("https://example.test", "a plain string, not an Error");
    expect(error.message).toBe("Request to https://example.test failed");
  });
});
