import { NextResponse, type NextRequest } from "next/server";
import { avatarChoiceSchema } from "../../../../lib/schemas/avatar";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { updateAvatar } from "../../../../server/services/auth";

/**
 * `PUT /api/auth/avatar` — a member sets **their own** generated avatar
 * (T108). The acting user comes from the session, never the body. The body
 * is `{ variant, seed, palette }` (each validated against the app's own
 * vocabulary — seeds are app-generated, never free text) or `null` to
 * reset to the T107 default. Responds with just `{ avatar }` — this flow
 * never returns an email address (T108).
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const userId = await requireUserId(request);
  const parsed = await parseBody(request, avatarChoiceSchema);
  if ("error" in parsed) return parsed.error;

  const user = await updateAvatar(userId, parsed.data);
  return NextResponse.json({ avatar: user.avatar });
});
