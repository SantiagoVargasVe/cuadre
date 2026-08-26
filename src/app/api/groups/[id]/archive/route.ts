import { NextResponse, type NextRequest } from "next/server";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { archiveGroup } from "../../../../../server/services/groups";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Owner only — archiveGroup() (services/groups.ts) throws NotGroupOwnerError otherwise. */
export const POST = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  const group = await archiveGroup(id, userId);
  return NextResponse.json({ group });
});
