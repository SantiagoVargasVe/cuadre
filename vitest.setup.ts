import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library's auto-cleanup detects a *global* afterEach; this
// repo never sets `test.globals: true` (every test file imports afterEach
// explicitly from "vitest" instead), so the auto-detection never fires and
// component trees from one test leak into the next. Registering it here
// explicitly — first surfaced by T014's first .test.tsx files, since no
// earlier test rendered more than one component per file.
afterEach(() => {
  cleanup();
});
