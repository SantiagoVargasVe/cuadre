import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { RateLimitExceededError, requireNotLimited } from "../../../../server/rate-limit";
import { InvalidCredentialsError, login } from "../../../../server/services/auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Thin per ADR-0003: Origin check, then rate limit **before** the Argon2
 * hash is computed — hashing first makes this a free CPU-exhaustion
 * primitive. Error shapes are hand-rolled here; T013 consolidates every
 * route behind one mapper.
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  try {
    await requireNotLimited(policies.login, `login:${clientIp(request)}`);
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
    const { user, token } = await login(parsed.data.email, parsed.data.password);
    const response = NextResponse.json({ user }, { status: 200 });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 },
      );
    }
    throw error;
  }
}
