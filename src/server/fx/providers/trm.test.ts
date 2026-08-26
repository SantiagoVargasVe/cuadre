import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidProviderResponseError, TrmRateNotFoundError } from "./errors";
import { checkTrmDivergence, fetchTrmRate } from "./trm";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

function mockFetchOnce(body: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(body) }));
}

describe("fetchTrmRate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("finds the row valid on the exact requested day", async () => {
    mockFetchOnce(fixture("trm-success.json"));
    const result = await fetchTrmRate("2026-08-25");
    expect(result).toEqual({
      rate: "3056.51",
      asOf: "2026-08-25",
      vigenciaDesde: "2026-08-25",
      vigenciaHasta: "2026-08-25",
    });
  });

  it("finds the row covering a date inside a multi-day window (a Friday spanning the weekend)", async () => {
    mockFetchOnce(fixture("trm-success.json"));
    const result = await fetchTrmRate("2026-08-23");
    expect(result.rate).toBe("3048.12");
    expect(result.vigenciaDesde).toBe("2026-08-22");
    expect(result.vigenciaHasta).toBe("2026-08-24");
  });

  it("throws TrmRateNotFoundError when no row covers the date", async () => {
    mockFetchOnce(fixture("trm-empty.json"));
    await expect(fetchTrmRate("2026-08-25")).rejects.toThrow(TrmRateNotFoundError);
  });

  it("throws InvalidProviderResponseError for a malformed payload", async () => {
    mockFetchOnce(JSON.stringify({ not: "an array" }));
    await expect(fetchTrmRate("2026-08-25")).rejects.toThrow(InvalidProviderResponseError);
  });
});

describe("checkTrmDivergence", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  it("does not warn or throw when the two sources agree closely", () => {
    expect(() => checkTrmDivergence("3042.806266", "3042.81", "2026-08-25")).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns (but does not throw) past the divergence threshold, never picking a winner", () => {
    // ADR-0008's own measured example: 0.45% apart is normal and shouldn't warn.
    expect(() => checkTrmDivergence("3042.81", "3056.51", "2026-08-25")).not.toThrow();
    expect(warn).not.toHaveBeenCalled();

    // A real anomaly — a wildly different rate — should warn, regardless
    // of which side (primary or TRM) happens to be the larger one.
    expect(() => checkTrmDivergence("3042.81", "4000.00", "2026-08-25")).not.toThrow();
    expect(() => checkTrmDivergence("4000.00", "3042.81", "2026-08-25")).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toContain("disagree");
  });
});
