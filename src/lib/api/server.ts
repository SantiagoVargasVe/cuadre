import "server-only";
import { cookies } from "next/headers";
import { ApiError, parseApiError } from "./errors";

export interface ApiFetchServerOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * The base a Server Component uses to reach *this app's own* Route
 * Handlers. It is always the loopback listener, never the public origin:
 * this is a one-container monolith, so the API is on the same host, and
 * building the URL from `x-forwarded-*` sent the request out to the public
 * hostname — which, on a Cloudflare-Tunnel-only deployment, means a NAT
 * hairpin (container → internet → Cloudflare → tunnel → same container)
 * that just times out (`ETIMEDOUT`). `PORT` is set by the Dockerfile and
 * matched by `next dev`; `INTERNAL_API_ORIGIN` overrides for anything
 * exotic. Read from `process.env` directly — like `PORT`/`HOSTNAME` in
 * instrumentation.ts, this is a deployment detail, not validated app config.
 */
function internalOrigin(): string {
  return process.env.INTERNAL_API_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

/**
 * The Server Component counterpart to `apiFetch` (client.ts) — for pages
 * that render from this app's own Route Handlers on the server
 * (frontend/CLAUDE.md § *Routes*: "Components call Route Handlers", full
 * stop, regardless of which side of the server/client boundary they're
 * on).
 *
 * A server-side `fetch` carries no cookie jar, so the session cookie is
 * forwarded explicitly via `next/headers` `cookies()`. `cache: "no-store"`
 * because this is always per-user data. The request never leaves the box —
 * see `INTERNAL_ORIGIN` above.
 */
export async function apiFetchServer<T>(
  path: string,
  options: ApiFetchServerOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;
  const cookieStore = await cookies();

  const response = await fetch(`${internalOrigin()}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      cookie: cookieStore.toString(),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export { ApiError };
