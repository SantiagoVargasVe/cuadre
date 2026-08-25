import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { envSchema } from "./src/server/config.schema";

// drizzle-kit runs outside Next, so nothing loads .env for it automatically.
// Imports config.schema.ts, not config.ts — the latter carries `server-only`,
// which throws outside Next's react-server module resolution.
// `quiet` suppresses dotenv's own randomized promotional "tip" log line.
loadEnv({ quiet: true });

const env = envSchema.parse(process.env);

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
