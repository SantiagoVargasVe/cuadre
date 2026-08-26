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
  const [middlewareModule, jwtModule] = await Promise.all([
    import("./middleware"),
    import("./server/auth/jwt"),
  ]);
  return { ...middlewareModule, ...jwtModule };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("middleware", () => {
  it("redirects an unauthenticated visit to /login, preserving the destination", async () => {
    const { middleware } = await freshModule();

    const request = new NextRequest("http://localhost:3000/g/some-group?tab=balances");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/g/some-group?tab=balances");
  });

  it("redirects a garbage session cookie the same way as no session at all", async () => {
    const { middleware } = await freshModule();

    const request = new NextRequest("http://localhost:3000/groups", {
      headers: { cookie: "cuadre_session=not-a-real-token" },
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
  });

  it("lets a valid session through untouched", async () => {
    const { middleware, signSessionToken } = await freshModule();
    const token = await signSessionToken("11111111-1111-1111-1111-111111111111");

    const request = new NextRequest("http://localhost:3000/g/some-group", {
      headers: { cookie: `cuadre_session=${token}` },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("also accepts a Bearer token", async () => {
    const { middleware, signSessionToken } = await freshModule();
    const token = await signSessionToken("11111111-1111-1111-1111-111111111111");

    const request = new NextRequest("http://localhost:3000/groups", {
      headers: { authorization: `Bearer ${token}` },
    });
    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});
