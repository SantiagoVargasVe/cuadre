import { NextResponse, type NextRequest } from "next/server";
import { createExpenseSchema } from "../../../../../lib/schemas/expenses";
import { expenseListQuerySchema } from "../../../../../lib/schemas/expenseFilters";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { parseBody } from "../../../../../server/http/parse-body";
import { parseQuery } from "../../../../../server/http/parse-query";
import { createExpense, listExpenses } from "../../../../../server/services/expenses";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Cursor-based; default 50, max 200 (api-contract.md § Conventions,
 * enforced in the service). Search and filter parameters (T115) are parsed
 * here and applied in SQL — filtering after the cursor would make the
 * result depend on how many pages had been loaded.
 */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const query = parseQuery(new URL(request.url).searchParams, expenseListQuerySchema);
  if ("error" in query) return query.error;

  const result = await listExpenses(groupId, userId, query.data);
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  if (!isOriginTrusted(request)) {
    throw new ForbiddenError("ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const parsed = await parseBody(request, createExpenseSchema);
  if ("error" in parsed) return parsed.error;

  const expense = await createExpense(groupId, userId, parsed.data);
  return NextResponse.json(expense, { status: 201 });
});
