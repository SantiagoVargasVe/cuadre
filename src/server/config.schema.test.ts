import { describe, expect, it } from "vitest";
import { envSchema } from "./config.schema";

const validEnv = {
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

describe("envSchema", () => {
  it("accepts a fully valid environment", () => {
    const result = envSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SUPPORTED_CURRENCIES).toEqual(["COP", "USD", "EUR"]);
      expect(result.data.FX_TRM_CROSSCHECK).toBe(true);
    }
  });

  it("treats an unset FX_REFRESH_TOKEN as disabled, not an error", () => {
    const { FX_REFRESH_TOKEN: _omit, ...rest } = validEnv;
    const result = envSchema.safeParse({ ...rest, FX_REFRESH_TOKEN: "" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FX_REFRESH_TOKEN).toBeUndefined();
    }
  });

  it("fails with the missing variable's name when a required var is absent", () => {
    const { AUTH_SECRET: _omit, ...withoutAuthSecret } = validEnv;
    const result = envSchema.safeParse(withoutAuthSecret);

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("AUTH_SECRET");
    }
  });

  it("rejects an AUTH_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({ ...validEnv, AUTH_SECRET: "too-short" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "AUTH_SECRET");
      expect(issue).toBeDefined();
    }
  });

  it("rejects a DEFAULT_CURRENCY outside SUPPORTED_CURRENCIES", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SUPPORTED_CURRENCIES: "COP,USD",
      DEFAULT_CURRENCY: "EUR",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "DEFAULT_CURRENCY");
      expect(issue).toBeDefined();
    }
  });

  it("rejects an empty SUPPORTED_CURRENCIES", () => {
    const result = envSchema.safeParse({ ...validEnv, SUPPORTED_CURRENCIES: "" });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported FX_PROVIDER", () => {
    const result = envSchema.safeParse({ ...validEnv, FX_PROVIDER: "ecb" });

    expect(result.success).toBe(false);
  });
});
