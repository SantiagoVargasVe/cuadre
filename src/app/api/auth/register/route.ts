import { NextResponse, type NextRequest } from "next/server";
import { registerSchema } from "../../../../lib/schemas/auth";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { register } from "../../../../server/services/auth";

/**
 * Origin check, then rate limit **before** the Argon2 hash — same ordering
 * as login (ADR-0003, security.md). EmailAlreadyRegisteredError and
 * InvalidInviteError, thrown from register(), are turned into the wire
 * shape by withErrorHandling.
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

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  await requireNotLimited(policies.register, `register:${clientIp(request.headers)}`);

  const { user, token } = await register(parsed.data);
  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
});
