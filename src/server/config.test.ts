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
  it("resolves the validated environment when it is valid", async () => {
    stubEnv(validEnv);

    const { config } = await import("./config");

    expect(config.DEFAULT_CURRENCY).toBe("COP");
    expect(config.SUPPORTED_CURRENCIES).toEqual(["COP", "USD", "EUR"]);
  });

  it("importing costs nothing — validation is deferred to the first access", async () => {
    const { AUTH_SECRET: _omit, ...withoutAuthSecret } = validEnv;
    stubEnv(withoutAuthSecret);

    // The import itself must not throw: next build walks this module graph
    // with no real environment.
    const { config, getConfig } = await import("./config");

    expect(() => getConfig()).toThrow(/AUTH_SECRET/);
    expect(() => config.DATABASE_URL).toThrow(/AUTH_SECRET/);
  });

  it("names every missing variable at once, not just the first", async () => {
    stubEnv({ APP_URL: "http://localhost:3000" });

    const { getConfig } = await import("./config");

    expect(() => getConfig()).toThrow(/AUTH_SECRET[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*AUTH_SECRET/);
  });

  it("memoizes — process.env is read once, on the first access", async () => {
    stubEnv(validEnv);

    const { getConfig } = await import("./config");
    const first = getConfig();

    vi.stubEnv("DEFAULT_CURRENCY", "USD");

    expect(getConfig()).toBe(first);
    expect(getConfig().DEFAULT_CURRENCY).toBe("COP");
  });
});
