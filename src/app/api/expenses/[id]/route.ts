import { NextResponse, type NextRequest } from "next/server";
import { createExpenseSchema } from "../../../../lib/schemas/expenses";
import { isOriginTrusted } from "../../../../server/auth/origin";
import { requireUserId } from "../../../../server/auth/session";
import { ForbiddenError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { parseBody } from "../../../../server/http/parse-body";
import { deleteExpense, getExpense, updateExpense } from "../../../../server/services/expenses";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** No group id in the URL — getExpense() checks membership against the row's own group_id. */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const userId = await requireUserId(request);

  const expense = await getExpense(id, userId);
  return NextResponse.json(expense);
});

/**
 * No group id in the URL — updateExpense() loads the row and checks
 * membership against *its* group_id (security.md § the trap). Replaces
 * the whole expense; there is no partial split patch (ADR-0005).
 */
export const PATCH = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, createExpenseSchema);
  if ("error" in parsed) return parsed.error;

  const expense = await updateExpense(id, userId, parsed.data);
  return NextResponse.json(expense);
});

/** Soft delete — sets deleted_at and writes a `deleted` revision. Nothing is hard-deleted. */
export const DELETE = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id } = await context.params;
  const userId = await requireUserId(request);

  await deleteExpense(id, userId);
  return new NextResponse(null, { status: 204 });
});
