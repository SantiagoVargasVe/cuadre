import { ApiError, parseApiError } from "./errors";

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * The one fetch wrapper for /api. Understands the error envelope from
 * docs/context/api-contract.md and throws ApiError so callers get `code`
 * and `details` intact rather than a string to re-parse.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  // A `204`, or any 2xx with no body (`/api/auth/forgot-password` answers
  // `202` with nothing) — `response.json()` on an empty body throws.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export { ApiError };
