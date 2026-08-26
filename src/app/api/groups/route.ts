import { NextResponse, type NextRequest } from "next/server";
import { createGroupSchema } from "../../../lib/schemas/groups";
import { isOriginTrusted } from "../../../server/auth/origin";
import { requireUserId } from "../../../server/auth/session";
import { ForbiddenError } from "../../../server/errors";
import { withErrorHandling } from "../../../server/http/map-error";
import { parseBody } from "../../../server/http/parse-body";
import { createGroup, listMyGroups } from "../../../server/services/groups";

/** Archived groups are included, flagged via `archivedAt` — never silently dropped. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const userId = await requireUserId(request);
  const items = await listMyGroups(userId);
  return NextResponse.json({ items });
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const userId = await requireUserId(request);

  const parsed = await parseBody(request, createGroupSchema);
  if ("error" in parsed) return parsed.error;

  const group = await createGroup(userId, parsed.data);
  return NextResponse.json({ group }, { status: 201 });
});
