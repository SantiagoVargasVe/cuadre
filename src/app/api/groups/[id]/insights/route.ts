import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { getInsights } from "../../../../../server/services/insights";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Server-computed spending aggregates for the insights charts (T081) —
 * by period, by member, by category, one block per currency. Takes no
 * query parameters; the buckets come from the group's own expense dates.
 * Membership is checked inside the service, so a non-member and a removed
 * member both get `404`.
 */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);
  return NextResponse.json(await getInsights(groupId, userId));
});
