import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "./server/auth/session";

/**
 * Gates every route under the authenticated shell. Runs before any layout
 * or page, so it's the one place that can see the pathname the visitor was
 * actually headed to — a Server Component layout can't, which is why this
 * lives here rather than in `(app)/layout.tsx`.
 *
 * `next build` warns that jose's JWE path touches Edge-unsupported
 * Compression/DecompressionStream APIs — a known false positive (jose
 * issue #562) that only matters for `jwtDecrypt`. This app only ever signs
 * and verifies JWS via `jwtVerify` (see jwt.ts), so it's inert here.
 */
export async function middleware(request: NextRequest) {
  const session = await getSession(request);
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/groups", "/groups/:path*", "/g/:path*", "/cuenta", "/cuenta/:path*"],
};
