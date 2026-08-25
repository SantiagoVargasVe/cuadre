import { NextResponse, type NextRequest } from "next/server";
import { registerSchema } from "../../../../lib/schemas/auth";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { RateLimitExceededError, requireNotLimited } from "../../../../server/rate-limit";
import { EmailAlreadyRegisteredError, register } from "../../../../server/services/auth";
import { InvalidInviteError } from "../../../../server/services/invites";

/**
 * Origin check, then rate limit **before** the Argon2 hash — same ordering
 * as login, same reasoning (ADR-0003, security.md). Error shapes are
 * hand-rolled here; T013 consolidates every route behind one mapper.
 */
export async function POST(request: NextRequest) {
  if (!isOriginTrusted(request)) {
    return NextResponse.json(
      { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed" } },
      { status: 403 },
    );
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

  try {
    await requireNotLimited(policies.register, `register:${clientIp(request)}`);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    throw error;
  }

  try {
    const { user, token } = await register(parsed.data);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json(
        { error: { code: "EMAIL_ALREADY_REGISTERED", message: "Email is already registered" } },
        { status: 409 },
      );
    }
    if (error instanceof InvalidInviteError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INVITE_CODE",
            message: "Invite code is invalid, expired, or already used",
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
