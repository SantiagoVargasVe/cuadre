import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestFailedError } from "./errors";
import { fetchWithRetry } from "./http";

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns the response on the first successful attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://example.test");
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on a non-2xx response, then throws if it fails again", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithRetry("https://example.test")).rejects.toThrow(ProviderRequestFailedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a hung request once the timeout elapses, and does not hang the caller", async () => {
    vi.useFakeTimers();
    // A fetch that never settles on its own — only resolves by reacting
    // to the abort signal, exactly like a real hung connection would.
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithRetry("https://example.test").catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000); // the retry's own timeout
    const error = await pending;

    expect(error).toBeInstanceOf(ProviderRequestFailedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
