import { NextResponse, type NextRequest } from "next/server";
import { createSettlementSchema } from "../../../../../lib/schemas/settlements";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { parseBody } from "../../../../../server/http/parse-body";
import { createSettlement, listSettlements } from "../../../../../server/services/settlements";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Cursor-based; default 50, max 200 (api-contract.md § Conventions, enforced in the service). */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const result = await listSettlements(groupId, userId, { cursor, limit });
  return NextResponse.json(result);
});

/** `fromUserId` is always the authenticated user (ADR-0009) — not a field on the body. */
export const POST = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, createSettlementSchema);
  if ("error" in parsed) return parsed.error;

  const settlement = await createSettlement(groupId, userId, parsed.data);
  return NextResponse.json(settlement, { status: 201 });
});
