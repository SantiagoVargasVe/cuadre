import { NextResponse, type NextRequest } from "next/server";
import { updateProfileSchema } from "../../../../lib/schemas/auth";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { updateProfile } from "../../../../server/services/auth";

/**
 * `PATCH /api/auth/profile` — a member edits **their own** profile (T109).
 * Today that means the display name, validated against the same bounds
 * registration uses. The acting user comes from the session; a `userId` in
 * the body is stripped by the schema and could not be honoured anyway.
 *
 * Responds with `{ user }` carrying id, displayName and avatar — no email,
 * matching `PUT /api/auth/avatar`. `GET /api/auth/me` stays the only
 * endpoint that returns an address, and only the caller's own.
 */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const userId = await requireUserId(request);
  const parsed = await parseBody(request, updateProfileSchema);
  if ("error" in parsed) return parsed.error;

  const user = await updateProfile(userId, parsed.data);
  return NextResponse.json({
    user: { id: user.id, displayName: user.displayName, avatar: user.avatar },
  });
});
