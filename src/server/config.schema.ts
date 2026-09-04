import { z } from "zod";

/**
 * Kept free of `import "server-only"` so `drizzle.config.ts` and other
 * tooling that runs outside Next can validate `process.env` without
 * tripping the client-boundary guard. See config.ts for the app-facing
 * singleton.
 */

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code, e.g. COP");

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/**
 * Outbound mail is optional *as a set* (ADR-0011). Either all five are
 * configured or none are — a half-set (a host with no password) is the
 * failure mode where recovery ships and silently sends nothing, so it
 * fails at boot instead. Named here so the schema and the cross-check
 * below stay in sync.
 */
const MAIL_KEYS = [
  "MAIL_SMTP_HOST",
  "MAIL_SMTP_PORT",
  "MAIL_SMTP_USER",
  "MAIL_SMTP_PASS",
  "MAIL_FROM",
] as const;

export const envSchema = z
  .object({
    APP_URL: z
      .url("must be an absolute URL")
      .refine((v) => !v.endsWith("/"), "must not have a trailing slash"),

    DATABASE_URL: z
      .url("must be a postgres connection string")
      .startsWith("postgres://", "must start with postgres://"),

    AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters — run: openssl rand -base64 48"),

    SUPPORTED_CURRENCIES: z
      .string()
      .min(1, "required — a comma-separated list of ISO-4217 codes")
      .transform((v) =>
        v
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      )
      .pipe(z.array(currencyCode).min(1, "must list at least one currency")),
    DEFAULT_CURRENCY: currencyCode,

    FX_PROVIDER: z.enum(["open-er-api"]),
    FX_BASE_CURRENCY: currencyCode,
    FX_TRM_CROSSCHECK: z.enum(["true", "false"]).transform((v) => v === "true"),
    FX_REFRESH_TOKEN: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .min(32, "must be at least 32 characters — run: openssl rand -hex 32")
        .optional(),
    ),

    // Outbound email over SMTP (ADR-0011). All optional; the app boots
    // with mail disabled when they're unset. `emptyToUndefined` so a blank
    // line in `.env` reads as unset, the same treatment FX_REFRESH_TOKEN
    // gets. The all-or-nothing rule is the `.superRefine` below.
    MAIL_SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_SMTP_PORT: z.preprocess(
      emptyToUndefined,
      z.coerce.number("must be a port number").int().positive().optional(),
    ),
    MAIL_SMTP_USER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_SMTP_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_FROM: z.preprocess(
      emptyToUndefined,
      z.email("must be an email address, e.g. no-reply@example.com").optional(),
    ),
  })
  .refine((env) => env.SUPPORTED_CURRENCIES.includes(env.DEFAULT_CURRENCY), {
    error: "DEFAULT_CURRENCY must be one of SUPPORTED_CURRENCIES",
    path: ["DEFAULT_CURRENCY"],
  })
  // Same idea as the DEFAULT_CURRENCY cross-check: a boot-time failure that
  // names what's wrong, rather than a mailer that looks fine until the one
  // send that matters (ADR-0011).
  .superRefine((env, ctx) => {
    const missing = MAIL_KEYS.filter((key) => env[key] === undefined);
    if (missing.length === 0 || missing.length === MAIL_KEYS.length) return;
    ctx.addIssue({
      code: "custom",
      path: [missing[0]!],
      message:
        `mail is partially configured — set all of ${MAIL_KEYS.join(", ")} together, or ` +
        `none. Missing: ${missing.join(", ")}`,
    });
  });

export type Env = z.infer<typeof envSchema>;

/** Formats Zod issues as `path: message` lines, one per line, for a boot-time error. */
export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/** Validate `env`, throwing one error that lists *every* problem rather than only the first. */
export function parseEnv(env: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatEnvError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * A memoized, **lazy** accessor over `readEnv()`. Nothing is validated until
 * the first call.
 *
 * Laziness is load-bearing: `next build` evaluates the module graph for static
 * analysis, so validating at import time would make the production build — and
 * every `docker build` — demand real secrets just to compile, and a
 * placeholder passed only to satisfy the build could mask a genuine
 * misconfiguration. Fail-fast isn't lost, it moves to the right moment:
 * `src/instrumentation.ts` calls the accessor once at server startup.
 */
export function createConfigAccessor(
  readEnv: () => Record<string, string | undefined>,
): () => Env {
  let cached: Env | undefined;
  return () => (cached ??= parseEnv(readEnv()));
}
