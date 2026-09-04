import { NextResponse, type NextRequest } from "next/server";
import { changePasswordSchema } from "../../../../lib/schemas/auth";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../server/auth/cookie";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { changePassword } from "../../../../server/services/auth";

/**
 * `POST /api/auth/change-password` — authenticated, Origin-checked. A wrong
 * `currentPassword` is `401 INVALID_CREDENTIALS`, indistinguishable from a
 * wrong password at login. Rate limited per user (Argon2 runs twice).
 *
 * On success the change bumps `sessions_valid_from` — revoking every
 * session, including this one — so the response carries a **replacement**
 * session cookie minted at the new boundary. The caller stays logged in;
 * every other session is out (T123).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const userId = await requireUserId(request);
  await requireNotLimited(policies.changePassword, `change-password:${userId}`);

  const parsed = await parseBody(request, changePasswordSchema);
  if ("error" in parsed) return parsed.error;

  const { token } = await changePassword(
    userId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
});
