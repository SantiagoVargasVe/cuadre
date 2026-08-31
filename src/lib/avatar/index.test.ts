import { describe, expect, it } from "vitest";
import {
  AVATAR_PALETTES,
  AVATAR_PALETTE_NAMES,
  AVATAR_VARIANTS,
  DEFAULT_PALETTE,
  DEFAULT_VARIANT,
  resolveAvatar,
} from "./index";

describe("resolveAvatar (T107 / T108)", () => {
  it("falls back to the T107 default when nothing is stored", () => {
    expect(resolveAvatar("user-1", null)).toEqual({
      variant: DEFAULT_VARIANT,
      seed: "user-1",
      colors: AVATAR_PALETTES[DEFAULT_PALETTE],
    });
    expect(resolveAvatar("user-1", undefined)).toEqual(resolveAvatar("user-1", null));
  });

  it("uses a full, valid stored choice", () => {
    expect(resolveAvatar("user-1", { variant: "pixel", seed: "abcdef", palette: "warm" })).toEqual({
      variant: "pixel",
      seed: "abcdef",
      colors: AVATAR_PALETTES.warm,
    });
  });

  it("guards each field independently — a bad value falls back, a good one stays", () => {
    const r = resolveAvatar("user-1", {
      variant: "nope" as never,
      seed: "ok",
      palette: "warm",
    });
    // seed "ok" is too short → back to userId; variant unknown → default; palette valid → kept.
    expect(r).toEqual({ variant: DEFAULT_VARIANT, seed: "user-1", colors: AVATAR_PALETTES.warm });
  });

  it("exposes exactly the six variants and the named palettes", () => {
    expect(AVATAR_VARIANTS).toEqual(["marble", "beam", "pixel", "sunset", "ring", "bauhaus"]);
    expect(AVATAR_PALETTE_NAMES.sort()).toEqual(["cool", "default", "warm"]);
    for (const name of AVATAR_PALETTE_NAMES) {
      expect(AVATAR_PALETTES[name].every((c) => /^#[0-9A-F]{6}$/i.test(c))).toBe(true);
    }
  });
});
