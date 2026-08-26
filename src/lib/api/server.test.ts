import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetchServer } from "./server";
import { ApiError } from "./errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const headerStore = new Map([
  ["host", "cuadre.example.com"],
  ["x-forwarded-proto", "https"],
]);

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "cuadre_session=abc123" }),
  headers: async () => ({ get: (key: string) => headerStore.get(key) ?? null }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetchServer", () => {
  it("builds an absolute URL from x-forwarded-proto and host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchServer("/api/groups");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://cuadre.example.com/api/groups");
  });

  it("forwards the session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchServer("/api/groups");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).cookie).toBe("cuadre_session=abc123");
  });

  it("never caches — this is always per-user data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchServer("/api/groups");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe("no-store");
  });

  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [{ id: "g1" }] })));

    const result = await apiFetchServer<{ items: { id: string }[] }>("/api/groups");

    expect(result).toEqual({ items: [{ id: "g1" }] });
  });

  it("throws a typed ApiError for a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "nope" } })),
    );

    const error = await apiFetchServer("/api/groups").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });

  it("sends a JSON body with the right content type when one is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchServer("/api/groups", { method: "POST", body: { title: "Cartagena" } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ title: "Cartagena" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});
