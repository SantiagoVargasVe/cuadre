import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        "src/lib/money/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/server/services/**": { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/server/**/*.test.ts", "src/lib/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "app",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/app/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
