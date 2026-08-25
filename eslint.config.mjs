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
    },
  },
  {
    // The FE/BE boundary: src/app/ renders and validates, src/server/ owns the
    // DB. See docs/context/architecture.md § Internal boundary and ADR-0001.
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/**", "drizzle-orm", "drizzle-orm/*"],
              message:
                "src/app/ must not import src/server/ or drizzle-orm directly — call a service instead. See ADR-0001.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
