import "server-only";
import type { NextRequest } from "next/server";
import { config } from "../config";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * ADR-0003's second requirement: every state-changing request validates
 * `Origin` against `APP_URL`. A request carrying a Bearer token is exempt
 * — Bearer adds no CSRF risk, since a browser never attaches it
 * automatically the way it does a cookie. No Origin and no Bearer on a
 * non-GET method is a rejection.
 *
 * The third requirement — GET never mutates — has no code representation;
 * it's a discipline every route handler has to keep. Regressing it here
 * would make the other two decorative.
 */
export function isOriginTrusted(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return true;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return true;

  return request.headers.get("origin") === config.APP_URL;
}
