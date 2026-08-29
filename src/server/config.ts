import "server-only";
import { createConfigAccessor, type Env } from "./config.schema";

/**
 * The one place this app reads `process.env`.
 *
 * Validation is **lazy and memoized** (see `createConfigAccessor`). Importing
 * this module costs nothing, so `next build` and the test runner can evaluate
 * the module graph with no real environment. `src/instrumentation.ts` forces
 * validation once at server startup, so a bad `.env` still fails at boot with
 * the name of what's wrong instead of surfacing as `undefined is not a
 * connection string` three modules deep on the first request.
 *
 * Never read `process.env` elsewhere, and never import `envSchema` from
 * `src/app/**` — import this.
 */
export const getConfig = createConfigAccessor(() => process.env);

/**
 * Property-access sugar: `config.DATABASE_URL` rather than
 * `getConfig().DATABASE_URL`. Every read resolves through the same memoized
 * accessor, so the first property access is what triggers validation.
 */
export const config = new Proxy({} as Env, {
  get: (_target, prop) => getConfig()[prop as keyof Env],
  has: (_target, prop) => prop in getConfig(),
  ownKeys: () => Reflect.ownKeys(getConfig()),
  getOwnPropertyDescriptor: (_target, prop) =>
    Reflect.getOwnPropertyDescriptor(getConfig(), prop),
});
