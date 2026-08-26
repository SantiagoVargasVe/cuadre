import { NextResponse, type NextRequest } from "next/server";
import { setDisplayCurrencySchema } from "../../../../../lib/schemas/groups";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { parseBody } from "../../../../../server/http/parse-body";
import {
  clearDisplayCurrency,
  getDisplayCurrency,
  setDisplayCurrency,
} from "../../../../../server/services/fx";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const result = await getDisplayCurrency(groupId, userId);
  return NextResponse.json(result);
});

/**
 * Snapshots the rates for every currency present in the group and writes
 * `group_fx_pins` — never touches an expense row (ADR-0007). Re-`PUT`ting
 * the same currency re-pins at today's rates; that's the only thing that
 * moves an already-converted group's numbers.
 */
export const PUT = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, setDisplayCurrencySchema);
  if ("error" in parsed) return parsed.error;

  const result = await setDisplayCurrency(groupId, userId, parsed.data.currency);
  return NextResponse.json(result);
});

/** Reverts to per-currency display. The pin rows are kept, not deleted. */
export const DELETE = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const result = await clearDisplayCurrency(groupId, userId);
  return NextResponse.json(result);
});
