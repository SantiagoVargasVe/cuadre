import { NextResponse, type NextRequest } from "next/server";
import { updateSettlementSchema } from "../../../../lib/schemas/settlements";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { deleteSettlement, updateSettlement } from "../../../../server/services/settlements";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * No group id in the URL — updateSettlement() loads the row and checks
 * membership against *its* group_id (security.md § the trap). Replaces
 * the whole settlement except `fromUserId`, which the input has no field
 * for (ADR-0009).
 */
export const PATCH = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, updateSettlementSchema);
  if ("error" in parsed) return parsed.error;

  const settlement = await updateSettlement(id, userId, parsed.data);
  return NextResponse.json(settlement);
});

/** Soft delete — sets deleted_at. Excluded from balances the moment this commits. */
export const DELETE = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  await deleteSettlement(id, userId);
  return new NextResponse(null, { status: 204 });
});
