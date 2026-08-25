import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const AUTH_SECRET = "a".repeat(48);

async function freshModule() {
  vi.resetModules();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://cuadre:change-me@localhost:5432/cuadre");
  vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
  vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
  vi.stubEnv("DEFAULT_CURRENCY", "COP");
  vi.stubEnv("FX_PROVIDER", "open-er-api");
  vi.stubEnv("FX_BASE_CURRENCY", "USD");
  vi.stubEnv("FX_TRM_CROSSCHECK", "true");
  return import("./jwt");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a userId", async () => {
    const { signSessionToken, verifySessionToken } = await freshModule();

    const token = await signSessionToken("user-123");
    const claims = await verifySessionToken(token);

    expect(claims).toEqual({ userId: "user-123" });
  });

  it("carries only sub, iat, exp — no other claims", async () => {
    const { signSessionToken } = await freshModule();
    const token = await signSessionToken("user-123");
    const payloadB64 = token.split(".")[1] ?? "";
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sub"]);
  });

  it("rejects an expired token", async () => {
    const { verifySessionToken } = await freshModule();

    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(AUTH_SECRET));

    expect(await verifySessionToken(expired)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { verifySessionToken } = await freshModule();

    const wrongSecretToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode("b".repeat(48)));

    expect(await verifySessionToken(wrongSecretToken)).toBeNull();
  });

  it("rejects a tampered / malformed token", async () => {
    const { verifySessionToken } = await freshModule();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("rejects a token claiming alg: none", async () => {
    const { verifySessionToken } = await freshModule();

    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-123" })).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    expect(await verifySessionToken(noneToken)).toBeNull();
  });
});
