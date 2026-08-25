import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, clearedSessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";

/** Clearing an already-absent or invalid cookie is harmless, so no session is required. */
export async function POST(request: NextRequest) {
  if (!isOriginTrusted(request)) {
    return NextResponse.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed" } },
      { status: 403 },
    );
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}
