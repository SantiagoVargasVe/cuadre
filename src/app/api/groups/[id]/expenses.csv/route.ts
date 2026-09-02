import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { exportExpensesCsv } from "../../../../../server/services/expenses-export";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** The complete private expense ledger as a CSV attachment. It accepts no
 * pagination parameters; service authorization makes non-members a 404. */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);
  const { filename, csv } = await exportExpensesCsv(groupId, userId);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
