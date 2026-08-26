import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { getBalancesView } from "../../../../../server/services/balances";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** An unrecognized value is treated as "not provided" — same forgiving parsing as a bad cursor. */
function parseSimplify(value: string | null): boolean | undefined {
  if (value === "on") return true;
  if (value === "off") return false;
  return undefined;
}

/**
 * `?simplify=on|off` is a preview override that never writes — defaults to
 * the group's own `simplifyDebts` setting when omitted (api-contract.md §
 * Balances). Flipping it for real is `PATCH /api/groups/:id`.
 */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const simplify = parseSimplify(new URL(request.url).searchParams.get("simplify"));

  const result = await getBalancesView(groupId, userId, { simplify });
  return NextResponse.json(result);
});
