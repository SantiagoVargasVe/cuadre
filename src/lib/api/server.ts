import "server-only";
import { cookies, headers } from "next/headers";
import { ApiError, parseApiError } from "./errors";

export interface ApiFetchServerOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * The Server Component counterpart to `apiFetch` (client.ts) — for pages
 * that render from this app's own Route Handlers on the server
 * (frontend/CLAUDE.md § *Routes*: "Components call Route Handlers", full
 * stop, regardless of which side of the server/client boundary they're
 * on).
 *
 * A Server Component's `fetch` has no browser to inherit an origin or a
 * cookie jar from, so both are rebuilt from the incoming request: the
 * origin from `x-forwarded-proto`/`host` — this app is only ever reached
 * through the Cloudflare Tunnel, which sets both (architecture.md applies
 * the same trust assumption to `CF-Connecting-IP`) — and the session
 * cookie forwarded explicitly via `next/headers` `cookies()`, since a
 * server-side fetch never carries it automatically. `cache: "no-store"`
 * because this is always per-user data.
 */
export async function apiFetchServer<T>(
  path: string,
  options: ApiFetchServerOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const origin = `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;

  const response = await fetch(`${origin}${path}`, {
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
