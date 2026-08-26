import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Leading underscore is how this repo marks a deliberately-unused
      // binding, e.g. destructuring a key off an object only to omit it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // design-system.md § *Money display*: exactly one place calls
      // Intl.NumberFormat on a money value, so the two verified es-CO
      // gotchas (COP's default fraction digits, EUR's literal "EUR") are
      // fixed once instead of being a trap every new component can fall
      // into again. Lifted for src/lib/money/format.ts below.
      "no-restricted-properties": [
        "error",
        {
          object: "Intl",
          property: "NumberFormat",
          message:
            "Only src/lib/money/format.ts may call Intl.NumberFormat — use formatMoney()/formatAmountInput() instead. See design-system.md § Money display.",
        },
      ],
    },
  },
  {
    files: ["src/lib/money/format.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // The FE/BE boundary: src/app/ renders and validates, src/server/db/ owns
    // the DB. Route handlers *are* meant to import src/server/services/,
    // src/server/auth/, and src/server/rate-limit/ directly — session,
    // cookie, and Origin handling are HTTP-layer concerns that operate on
    // Request/Response, which is exactly what a "service" (framework-agnostic,
    // plain arguments in, plain objects out — see backend/CLAUDE.md § Layering)
    // is not. What's actually forbidden is touching Drizzle or the DB client
    // directly. See docs/context/architecture.md § Internal boundary and
    // ADR-0001.
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/db/**", "drizzle-orm", "drizzle-orm/*"],
              message:
                "src/app/ must not import src/server/db/ or drizzle-orm directly — call a service instead. See ADR-0001.",
            },
          ],
        },
      ],
    },
  },
  {
    // The DB-access boundary is a production-code concern — a test file
    // under src/app/** legitimately sets up its own fixtures directly
    // against the database (as the equivalent tests under src/server/db/
    // already do). max-lines still applies: a test file over 100 lines
    // wants splitting same as a component would.
    files: ["src/app/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
