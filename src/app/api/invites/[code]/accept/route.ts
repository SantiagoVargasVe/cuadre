import { NextResponse, type NextRequest } from "next/server";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { acceptInvite } from "../../../../../server/services/invites";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/** For an already-registered user. The new-account path is POST /api/auth/register instead. */
export const POST = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { code } = await context.params;
  const userId = await requireUserId(request);

  const group = await acceptInvite(code, userId);
  return NextResponse.json({ group });
});
