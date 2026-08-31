import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tailwind v4 stopped shipping `cursor: pointer` for `button` / `[role="button"]`
 * and nothing here opted back in, so on desktop no control read as clickable
 * (T100). The fix is a single base-layer rule in globals.css — there is no
 * component render to assert against, and jsdom applies no stylesheet, so this
 * guards the rule at the source instead. Its real job is to stop a future
 * reader deleting it as "redundant with Tailwind": it is not.
 */
// Vitest runs from the repo root; the jsdom project has no reliable __dirname
// and `import.meta.url` is an http: URL under Vite, so resolve from cwd.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

interface Rule {
  selector: string;
  body: string;
}

/** Every `<selectorList> { … }` block in the file, flattened. */
const rules: Rule[] = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({
  selector: m[1] ?? "",
  body: m[2] ?? "",
}));

const pointerRules = rules.filter((r) => /cursor:\s*pointer/.test(r.body));
const defaultRules = rules.filter((r) => /cursor:\s*default/.test(r.body));

describe("globals.css pointer-cursor rule (T100)", () => {
  it("gives a plain <button> cursor: pointer", () => {
    expect(pointerRules.some((r) => /(^|[\s,])button(\s|,|$)/.test(r.selector))).toBe(true);
  });

  it("covers the ARIA roles Base UI renders instead of a <button>", () => {
    // Switch/Checkbox/Radio are a <span role="…">, SelectItem a <div role="option"> —
    // a `button`-only rule would miss every one of them.
    for (const role of ['[role="option"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]']) {
      expect(
        pointerRules.some((r) => r.selector.includes(role)),
        `expected a cursor: pointer rule to cover ${role}`,
      ).toBe(true);
    }
  });

  it("opts a disabled control back out to cursor: default", () => {
    expect(defaultRules.some((r) => r.selector.includes("[data-disabled]"))).toBe(true);
    expect(defaultRules.some((r) => r.selector.includes('[aria-disabled="true"]'))).toBe(true);
  });

  it("is not a blanket rule — text inputs and `*` are never handed a pointer", () => {
    for (const rule of pointerRules) {
      expect(rule.selector).not.toMatch(/(^|[\s,])input(\s|,|$)/);
      expect(rule.selector).not.toMatch(/(^|[\s,])\*(\s|,|$)/);
    }
  });
});
