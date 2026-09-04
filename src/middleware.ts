import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./server/auth/cookie";
import { verifySessionToken } from "./server/auth/jwt";

/** Bearer header (future native clients) or the session cookie (browser navigation). */
function requestToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Gates every route under the authenticated shell. Runs before any layout
 * or page, so it's the one place that can see the pathname the visitor was
 * actually headed to — a Server Component layout can't, which is why this
 * lives here rather than in `(app)/layout.tsx`.
 *
 * **Deliberately crypto-only.** It checks that the token is well-formed
 * and unexpired — nothing more. It does *not* read
 * `users.sessions_valid_from` (T123): middleware runs on the Edge runtime
 * where the Postgres driver can't follow, and it is a redirect gate, not
 * an authorization boundary. A token that is validly signed but *revoked*
 * (its `iat` predates the account's session epoch, e.g. after a password
 * reset) passes here and is then rejected by the first Route Handler the
 * page calls; `apiFetchServer` turns that `401` into a redirect to
 * `/login`. Switching this to the Node runtime to add the lookup would buy
 * a redirect at the price of a second identical read on every navigation
 * (ADR-0012 § *Why sessions must become revocable*).
 *
 * `next build` warns that jose's JWE path touches Edge-unsupported
 * Compression/DecompressionStream APIs — a known false positive (jose
 * issue #562) that only matters for `jwtDecrypt`. This app only ever signs
 * and verifies JWS via `jwtVerify` (see jwt.ts), so it's inert here.
 */
export async function middleware(request: NextRequest) {
  const token = requestToken(request);
  const claims = token ? await verifySessionToken(token) : null;
  if (claims) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/groups", "/groups/:path*", "/g/:path*", "/cuenta", "/cuenta/:path*"],
};
