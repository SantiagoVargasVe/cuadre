import { NextResponse, type NextRequest } from "next/server";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { resendVerification } from "../../../../server/services/email-verification";

/**
 * `POST /api/auth/resend-verification` — authenticated, Origin-checked.
 * Mints a fresh verification token (invalidating the previous one) and
 * mails the caller's own address. Returns `204` whether or not the account
 * is already verified and whether or not mail is configured — the caller
 * learns nothing about their own account they didn't already know.
 *
 * Rate limited per **user**: the caller is authenticated, so their id is a
 * better key than an address, and the limit is what stops someone
 * mailbombing the address on file.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const userId = await requireUserId(request);
  await requireNotLimited(policies.verificationResend, `verification-resend:${userId}`);

  await resendVerification(userId);
  return new NextResponse(null, { status: 204 });
});
