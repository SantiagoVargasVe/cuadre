import "server-only";
import { envSchema, formatEnvError } from "./config.schema";

/**
 * The one place this app reads `process.env`. Validated once, at import
 * time, so a bad `.env` fails at boot with the name of what's wrong instead
 * of surfacing as `undefined is not a connection string` three modules deep.
 * Never import `envSchema` directly from `src/app/**` — import this instead.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${formatEnvError(parsed.error)}`);
}

export const config = parsed.data;
