import { NextResponse, type NextRequest } from "next/server";
import { resetPasswordSchema } from "../../../../lib/schemas/auth";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { ipKey } from "../../../../server/rate-limit/keys";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { resetPassword } from "../../../../server/services/password-reset";

/**
 * `POST /api/auth/reset-password` — `{ token, password }`, `204` on
 * success. Invalid, expired, used, and wrong-purpose tokens all return
 * the same generic `400 INVALID_TOKEN`. The password is held to exactly
 * registration's rule by reusing its schema field.
 *
 * Success **does not log the caller in** and sets no cookie — a link
 * arriving in a mailbox is not proof of session intent, and the page
 * redirects to `/login` (T126). `resetPassword` also moves
 * `sessions_valid_from`, so every session that existed before the reset
 * stops working (T123).
 *
 * Rate limited per IP: against 256 bits of token entropy this isn't
 * stopping a guess, it's stopping Argon2 CPU burn.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const parsed = await parseBody(request, resetPasswordSchema);
  if ("error" in parsed) return parsed.error;

  await requireNotLimited(
    policies.passwordResetConsume,
    ipKey("password-reset-consume", clientIp(request.headers)),
  );

  await resetPassword(parsed.data.token, parsed.data.password);
  return new NextResponse(null, { status: 204 });
});
