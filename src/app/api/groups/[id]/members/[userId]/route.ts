import { NextResponse, type NextRequest } from "next/server";
import { isOriginTrusted } from "../../../../../../server/auth/origin";
import { requireUserId } from "../../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../../server/errors";
import { withErrorHandling } from "../../../../../../server/http/map-error";
import { removeMember } from "../../../../../../server/services/members";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/** Owner only — removeMember() enforces this and the balance/last-owner guards. */
export const DELETE = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id: groupId, userId: targetUserId } = await context.params;
  const actingUserId = await requireUserId(request);

  await removeMember(groupId, actingUserId, targetUserId);
  return new NextResponse(null, { status: 204 });
});
