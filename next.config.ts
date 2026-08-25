import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // postgres-js and drizzle-orm's migrator are Node-only (crypto, fs, net,
  // tls, ...) and shouldn't be bundled by webpack at all — required at
  // runtime instead. See ADR notes in the sibling wishlist repo's
  // next.config.ts, which hit and solved this same problem first.
  // @node-rs/argon2 is a native N-API module for the same reason.
  serverExternalPackages: ["drizzle-orm", "postgres", "@node-rs/argon2"],

  // Next prepares an edge-compatible bundle of instrumentation.ts — "Next.js
  // calls register in all environments" per its own docs — and `next dev`
  // also runs it through the browser/client compiler pass. Neither target
  // can resolve migrate.ts's dependency chain (drizzle-orm's migrator needs
  // node:crypto; postgres needs net/tls/fs/os/stream/...) even though
  // instrumentation.ts only ever calls it behind a NEXT_RUNTIME === 'nodejs'
  // guard, Next's own documented pattern — that guard prevents *execution*,
  // not webpack's static discovery of the import. `next build` alone doesn't
  // reproduce this; only `next dev` does, because dev skips the dead-code
  // elimination that would otherwise drop the unreachable branch.
  //
  // Stub it for every target except the real Node.js server, which is the
  // only one that ever executes it.
  //
  // The alias key must be an absolute path. Webpack resolves alias keys
  // relative to the compiler's root context (the project root), not relative
  // to the file doing the importing — the string "./server/db/migrate"
  // written as a key would target <root>/server/db/migrate, not
  // <root>/src/server/db/migrate, and silently never match anything.
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime !== "nodejs") {
      config.resolve.alias[path.resolve(process.cwd(), "src/server/db/migrate")] = false;
    }
    return config;
  },

  // Migrations run at boot from instrumentation.ts, so the SQL files have to
  // be in the image. Next only traces code it can follow through imports;
  // raw .sql read at runtime is invisible to it and must be included
  // explicitly.
  outputFileTracingIncludes: {
    "/": ["./src/server/db/migrations/**/*"],
  },
};

export default nextConfig;
