import { NextResponse, type NextRequest } from "next/server";
import { forgotPasswordSchema } from "../../../../lib/schemas/auth";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { hashedAddressKey, ipKey } from "../../../../server/rate-limit/keys";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { requestPasswordReset } from "../../../../server/services/password-reset";

/**
 * `POST /api/auth/forgot-password` — **always `202`, identical body, no
 * matter what.** Registered, unknown, unverified, mail unconfigured, or a
 * failed send: same status, same (empty) body, and `requestPasswordReset`
 * does no Argon2 work on any path, so timing doesn't separate them either.
 * Any branch a client can observe is an enumeration oracle (ADR-0012).
 *
 * Two buckets, both `passwordResetRequest`: per IP stops a spray across
 * many accounts, per **hashed** address stops mailbombing one inbox, and
 * neither substitutes for the other. Either being exhausted is a `429`
 * with `Retry-After`.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const parsed = await parseBody(request, forgotPasswordSchema);
  if ("error" in parsed) return parsed.error;

  await requireNotLimited(
    policies.passwordResetRequest,
    ipKey("password-reset", clientIp(request.headers)),
  );
  await requireNotLimited(
    policies.passwordResetRequest,
    hashedAddressKey("password-reset-addr", parsed.data.email),
  );

  await requestPasswordReset(parsed.data.email);
  return new NextResponse(null, { status: 202 });
});
