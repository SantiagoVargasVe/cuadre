import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { ipKey } from "../../../../server/rate-limit/keys";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { markEmailVerified } from "../../../../server/services/password-reset";

const bodySchema = z.object({ token: z.string().min(1) });

/**
 * `POST /api/auth/verify-email` — unauthenticated; the link is the whole
 * credential. Marks the address verified and returns `204`. Invalid,
 * expired, used, and wrong-purpose tokens are indistinguishable: one
 * generic `400` from `markEmailVerified`'s `InvalidAuthTokenError`
 * (ADR-0013). Rate limited per IP — a 24-hour, single-use, 256-bit token
 * isn't brute-forceable, so the limit just caps wasted work.
 *
 * No Origin check: there is no session to forge a request on behalf of.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireNotLimited(
    policies.emailVerifyConsume,
    ipKey("email-verify", clientIp(request.headers)),
  );

  const parsed = await parseBody(request, bodySchema);
  if ("error" in parsed) return parsed.error;

  await markEmailVerified(parsed.data.token);
  return new NextResponse(null, { status: 204 });
});
