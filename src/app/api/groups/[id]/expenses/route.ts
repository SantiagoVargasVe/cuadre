import { NextResponse, type NextRequest } from "next/server";
import { createExpenseSchema } from "../../../../../lib/schemas/expenses";
import { isOriginTrusted } from "../../../../../server/auth/origin";
import { requireUserId } from "../../../../../server/auth/session";
import { ForbiddenError } from "../../../../../server/errors";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { parseBody } from "../../../../../server/http/parse-body";
import { createExpense } from "../../../../../server/services/expenses";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET (the feed) is T036 — this file only creates. */
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
