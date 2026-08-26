import { NextResponse, type NextRequest } from "next/server";
import { updateGroupSchema } from "../../../../lib/schemas/groups";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { getGroupDetail, updateGroup } from "../../../../server/services/groups";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const userId = await requireUserId(request);

  const { group, members } = await getGroupDetail(id, userId);
  return NextResponse.json({ group, members });
});

/** Any current member may PATCH, including the title — security.md's "editing an
 * expense" reasoning applies here too. Only archive is owner-only. */
export const PATCH = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, updateGroupSchema);
  if ("error" in parsed) return parsed.error;

  const group = await updateGroup(id, userId, parsed.data);
  return NextResponse.json({ group });
});
