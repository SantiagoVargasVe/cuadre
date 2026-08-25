import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const APP_URL = "http://localhost:3000";

/**
 * Pure cookie-clearing + Origin check — no DB involved, so this runs
 * unconditionally rather than behind hasTestDatabase. DATABASE_URL just
 * needs to satisfy the schema shape; nothing ever connects with it here.
 */
describe("POST /api/auth/logout", () => {
  let logoutPOST: typeof import("./route").POST;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", "postgres://cuadre:change-me@localhost:5432/cuadre");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: logoutPOST } = await import("./route"));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("clears the session cookie", async () => {
    const response = await logoutPOST(
      new NextRequest(`${APP_URL}/api/auth/logout`, {
        method: "POST",
        headers: { origin: APP_URL },
      }),
    );

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("cuadre_session=;");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it("rejects a cross-origin logout", async () => {
    const response = await logoutPOST(
      new NextRequest(`${APP_URL}/api/auth/logout`, {
        method: "POST",
        headers: { origin: "https://evil.example.com" },
      }),
    );

    expect(response.status).toBe(403);
  });
});
