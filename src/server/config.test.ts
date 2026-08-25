import { afterEach, describe, expect, it, vi } from "vitest";

const validEnv: Record<string, string> = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://cuadre:change-me@localhost:5432/cuadre",
  AUTH_SECRET: "a".repeat(32),
  SUPPORTED_CURRENCIES: "COP,USD,EUR",
  DEFAULT_CURRENCY: "COP",
  FX_PROVIDER: "open-er-api",
  FX_BASE_CURRENCY: "USD",
  FX_TRM_CROSSCHECK: "true",
  FX_REFRESH_TOKEN: "b".repeat(32),
};

function stubEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("config", () => {
  it("boots with the validated environment when it is valid", async () => {
    stubEnv(validEnv);

    const { config } = await import("./config");

    expect(config.DEFAULT_CURRENCY).toBe("COP");
    expect(config.SUPPORTED_CURRENCIES).toEqual(["COP", "USD", "EUR"]);
  });

  it("throws at import time, naming the missing variable, when required config is absent", async () => {
    const { AUTH_SECRET: _omit, ...withoutAuthSecret } = validEnv;
    stubEnv(withoutAuthSecret);

    await expect(import("./config")).rejects.toThrow(/AUTH_SECRET/);
  });
});
