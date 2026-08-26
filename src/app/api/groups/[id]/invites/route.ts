import { NextResponse, type NextRequest } from "next/server";
import { createInviteSchema } from "../../../../../lib/schemas/invites";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { parseBody } from "../../../../../server/http/parse-body";
import { createInvite } from "../../../../../server/services/invites";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Any current member may mint — no approval step (api-contract.md). */
export const POST = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, createInviteSchema);
  if ("error" in parsed) return parsed.error;

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;
  const { code, url } = await createInvite(id, userId, { expiresAt });
  return NextResponse.json({ code, url }, { status: 201 });
});
