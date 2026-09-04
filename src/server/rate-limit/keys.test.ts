import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashedAddressKey, ipKey } from "./keys";

describe("rate-limit bucket keys", () => {
  it("namespaces an IP key in the existing plaintext shape", () => {
    expect(ipKey("password-reset", "203.0.113.7")).toBe("password-reset:203.0.113.7");
  });

  it("keys an address by the SHA-256 of its normalized form, never the address itself", () => {
    const key = hashedAddressKey("password-reset", "  Ana@Example.com ");
    const expectedDigest = createHash("sha256").update("ana@example.com").digest("hex");

    expect(key).toBe(`password-reset:${expectedDigest}`);
    expect(key).not.toContain("Ana");
    expect(key).not.toContain("example.com");
  });

  it("collapses case and surrounding whitespace to one bucket", () => {
    expect(hashedAddressKey("x", "ana@example.com")).toBe(hashedAddressKey("x", " ANA@Example.com "));
  });

  it("separates different addresses and different namespaces", () => {
    expect(hashedAddressKey("x", "ana@example.com")).not.toBe(hashedAddressKey("x", "beto@example.com"));
    expect(hashedAddressKey("x", "ana@example.com")).not.toBe(hashedAddressKey("y", "ana@example.com"));
  });
});
