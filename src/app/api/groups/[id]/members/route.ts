import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { listMembers } from "../../../../../server/services/members";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const members = await listMembers(groupId, userId);
  return NextResponse.json({ members });
});
