import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function freshModule() {
  vi.resetModules();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://cuadre:change-me@localhost:5432/cuadre");
  vi.stubEnv("AUTH_SECRET", "a".repeat(48));
  vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
  vi.stubEnv("DEFAULT_CURRENCY", "COP");
  vi.stubEnv("FX_PROVIDER", "open-er-api");
  vi.stubEnv("FX_BASE_CURRENCY", "USD");
  vi.stubEnv("FX_TRM_CROSSCHECK", "true");
  return import("./origin");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isOriginTrusted", () => {
  it("always trusts GET and HEAD, regardless of Origin", async () => {
    const { isOriginTrusted } = await freshModule();

    const get = new NextRequest("http://localhost:3000/api/groups", {
      method: "GET",
      headers: { origin: "https://evil.example.com" },
    });
    const head = new NextRequest("http://localhost:3000/api/groups", { method: "HEAD" });

    expect(isOriginTrusted(get)).toBe(true);
    expect(isOriginTrusted(head)).toBe(true);
  });

  it("trusts a POST carrying a Bearer token, regardless of Origin", async () => {
    const { isOriginTrusted } = await freshModule();

    const request = new NextRequest("http://localhost:3000/api/groups", {
      method: "POST",
      headers: { authorization: "Bearer whatever" },
    });

    expect(isOriginTrusted(request)).toBe(true);
  });

  it("accepts a POST whose Origin matches APP_URL", async () => {
    const { isOriginTrusted } = await freshModule();

    const request = new NextRequest("http://localhost:3000/api/groups", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    expect(isOriginTrusted(request)).toBe(true);
  });

  /**
   * The control most likely to be quietly removed by someone debugging a
   * local CORS problem (T012 acceptance criteria) — a cross-origin POST
   * carrying a valid session cookie must still be rejected. The cookie
   * alone proves nothing about which site sent the request; that's exactly
   * what CSRF exploits.
   */
  it("rejects a cross-origin POST even with a valid session cookie attached", async () => {
    const { isOriginTrusted } = await freshModule();

    const request = new NextRequest("http://localhost:3000/api/groups", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        cookie: "cuadre_session=some.valid.looking.jwt",
      },
    });

    expect(isOriginTrusted(request)).toBe(false);
  });

  it("rejects a POST with no Origin header and no Bearer token", async () => {
    const { isOriginTrusted } = await freshModule();

    const request = new NextRequest("http://localhost:3000/api/groups", { method: "POST" });

    expect(isOriginTrusted(request)).toBe(false);
  });
});
