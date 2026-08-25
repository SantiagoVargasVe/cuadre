import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "./cookie";

async function freshModules() {
  vi.resetModules();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://cuadre:change-me@localhost:5432/cuadre");
  vi.stubEnv("AUTH_SECRET", "a".repeat(48));
  vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
  vi.stubEnv("DEFAULT_CURRENCY", "COP");
  vi.stubEnv("FX_PROVIDER", "open-er-api");
  vi.stubEnv("FX_BASE_CURRENCY", "USD");
  vi.stubEnv("FX_TRM_CROSSCHECK", "true");
  const jwt = await import("./jwt");
  const session = await import("./session");
  return { jwt, session };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getSession", () => {
  it("accepts a valid token from the session cookie", async () => {
    const { jwt, session } = await freshModules();
    const token = await jwt.signSessionToken("user-1");

    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    expect(await session.getSession(request)).toEqual({ userId: "user-1" });
  });

  it("accepts a valid token from an Authorization: Bearer header", async () => {
    const { jwt, session } = await freshModules();
    const token = await jwt.signSessionToken("user-1");

    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(await session.getSession(request)).toEqual({ userId: "user-1" });
  });

  it("returns null with no cookie and no bearer header", async () => {
    const { session } = await freshModules();
    const request = new NextRequest("http://localhost:3000/api/auth/me");

    expect(await session.getSession(request)).toBeNull();
  });

  it("returns null for a malformed Authorization header", async () => {
    const { session } = await freshModules();
    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });

    expect(await session.getSession(request)).toBeNull();
  });
});

describe("requireUserId", () => {
  it("returns the userId when a session is present", async () => {
    const { jwt, session } = await freshModules();
    const token = await jwt.signSessionToken("user-1");
    const request = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(await session.requireUserId(request)).toBe("user-1");
  });

  it("throws UnauthorizedError when there's no session", async () => {
    const { session } = await freshModules();
    const request = new NextRequest("http://localhost:3000/api/auth/me");

    await expect(session.requireUserId(request)).rejects.toThrow(session.UnauthorizedError);
  });
});
