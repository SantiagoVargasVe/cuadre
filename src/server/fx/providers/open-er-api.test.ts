import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidProviderResponseError, MissingCurrencyError, ProviderReturnedErrorError } from "./errors";
import { openErApiProvider } from "./open-er-api";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

function mockFetchOnce(body: string, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, text: () => Promise.resolve(body) }),
  );
}

describe("openErApiProvider.fetchRates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a valid payload to the expected rates and asOf, exactly as transmitted", async () => {
    mockFetchOnce(fixture("open-er-api-success.json"));

    const result = await openErApiProvider.fetchRates("USD", ["COP", "EUR"]);

    expect(result).toEqual({
      baseCurrency: "USD",
      asOf: "2026-08-26",
      source: "open-er-api",
      rates: { COP: "3062.957648", EUR: "0.856908" },
    });
  });

  it("preserves the exact wire digits rather than a float round-trip", async () => {
    // A rate with more significant digits than a double reliably keeps —
    // response.json() would risk trailing-digit drift; the raw-text
    // extraction this provider uses must not.
    mockFetchOnce(
      JSON.stringify({
        result: "success",
        time_last_update_utc: "Wed, 26 Aug 2026 00:02:31 +0000",
        base_code: "USD",
        rates: { USD: 1, COP: 3062.9576481234, EUR: 0.8569081234 },
      }),
    );

    const result = await openErApiProvider.fetchRates("USD", ["COP"]);
    expect(result.rates.COP).toBe("3062.9576481234");
  });

  it("throws ProviderReturnedErrorError for an error payload, without returning any rates", async () => {
    mockFetchOnce(fixture("open-er-api-error.json"));
    await expect(openErApiProvider.fetchRates("ZZZ", ["COP"])).rejects.toThrow(ProviderReturnedErrorError);
  });

  it("throws MissingCurrencyError rather than writing a partial set", async () => {
    mockFetchOnce(fixture("open-er-api-missing-currency.json"));
    const error = await openErApiProvider.fetchRates("USD", ["COP", "EUR"]).catch((e) => e);
    expect(error).toBeInstanceOf(MissingCurrencyError);
    expect(error.currency).toBe("EUR");
  });

  it("throws InvalidProviderResponseError for a response that doesn't match either known shape", async () => {
    mockFetchOnce(JSON.stringify({ unexpected: "shape" }));
    await expect(openErApiProvider.fetchRates("USD", ["COP"])).rejects.toThrow(InvalidProviderResponseError);
  });

  it("throws InvalidProviderResponseError for an unparseable time_last_update_utc", async () => {
    mockFetchOnce(
      JSON.stringify({
        result: "success",
        time_last_update_utc: "not a date",
        base_code: "USD",
        rates: { USD: 1, COP: 3000 },
      }),
    );
    await expect(openErApiProvider.fetchRates("USD", ["COP"])).rejects.toThrow(InvalidProviderResponseError);
  });

  it("retries once on a failed request before throwing", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(fixture("open-er-api-success.json")) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await openErApiProvider.fetchRates("USD", ["COP"]);
    expect(result.rates.COP).toBe("3062.957648");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
