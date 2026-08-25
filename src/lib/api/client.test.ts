import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { ApiError } from "./errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { group: { id: "g1" } })));

    const result = await apiFetch<{ group: { id: string } }>("/api/groups/g1");

    expect(result).toEqual({ group: { id: "g1" } });
  });

  it("returns undefined for a 204 response without reading a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await apiFetch("/api/expenses/e1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("sends a JSON body with the right content type when one is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/groups", { method: "POST", body: { title: "Cartagena" } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ title: "Cartagena" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it.each([
    [400, "VALIDATION_ERROR", undefined],
    [401, "UNAUTHENTICATED", undefined],
    [403, "FORBIDDEN", undefined],
    [404, "NOT_FOUND", undefined],
    [409, "INVITE_ALREADY_CONSUMED", undefined],
    [429, "RATE_LIMITED", undefined],
    [
      422,
      "SPLITS_DO_NOT_BALANCE",
      { expected: "30000000", actual: "29999999", difference: "1" },
    ],
  ] as const)(
    "maps a %i response with code %s into a typed ApiError",
    async (status, code, details) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(status, { error: { code, message: "nope", details } })),
      );

      const error = await apiFetch("/api/whatever").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(status);
      expect(apiError.code).toBe(code);
      expect(apiError.message).toBe("nope");
      expect(apiError.details).toEqual(details);
    },
  );

  it("falls back to a generic ApiError when the error body isn't the documented envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 })),
    );

    const error = await apiFetch("/api/whatever").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe("UNKNOWN_ERROR");
  });
});
