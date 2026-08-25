import { NextResponse, type NextRequest } from "next/server";
import { loginSchema } from "../../../../lib/schemas/auth";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { login } from "../../../../server/services/auth";

/**
 * Origin check, then rate limit **before** the Argon2 hash is computed —
 * hashing first makes this a free CPU-exhaustion primitive (ADR-0003,
 * security.md). Anything thrown after this point — ForbiddenError,
 * RateLimitError, InvalidCredentialsError — is turned into the wire shape
 * by withErrorHandling; this route only builds the 200 response.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  await requireNotLimited(policies.login, `login:${clientIp(request)}`);

  const { user, token } = await login(parsed.data.email, parsed.data.password);
  const response = NextResponse.json({ user }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
});
