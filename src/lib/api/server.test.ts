import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetchServer } from "./server";
import { ApiError } from "./errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "cuadre_session=abc123" }),
}));

// `redirect` throws NEXT_REDIRECT in Next; a plain throw is enough to
// assert the branch was taken without pulling in the framework.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("apiFetchServer", () => {
  it("hits the loopback listener, never the public origin (no NAT hairpin)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchServer("/api/groups");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3000/api/groups");
  });

  it("honours INTERNAL_API_ORIGIN and PORT for the base", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("PORT", "8080");
    await apiFetchServer("/api/groups");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://127.0.0.1:8080/api/groups");

    vi.stubEnv("INTERNAL_API_ORIGIN", "http://cuadre-app:3000");
    await apiFetchServer("/api/groups");
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("http://cuadre-app:3000/api/groups");
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

  it("throws a typed ApiError for a non-ok, non-401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(422, { error: { code: "SPLITS_DO_NOT_BALANCE", message: "nope" } })),
    );

    const error = await apiFetchServer("/api/groups").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
  });

  it("redirects to /login on a 401 instead of surfacing an error boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "nope" } })),
    );

    const error = await apiFetchServer("/api/groups").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("NEXT_REDIRECT:/login");
    expect(error).not.toBeInstanceOf(ApiError);
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
