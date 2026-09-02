import { NextResponse, type NextRequest } from "next/server";
import { toWire } from "../../../../../lib/money/wire";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import {
  listExpenseRevisions,
  type ExpenseRevisionView,
} from "../../../../../server/services/expenses-revisions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function serializeRevision(revision: ExpenseRevisionView) {
  return {
    ...revision,
    changes: revision.changes.map((change) => {
      if (change.kind === "text") return change;
      if (change.kind === "money") return { ...change, from: toWire(change.from), to: toWire(change.to) };
      return {
        ...change,
        from: change.from ? toWire(change.from) : null,
        to: change.to ? toWire(change.to) : null,
      };
    }),
  };
}

/** The service loads the id-addressed expense and checks its own group membership. */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const userId = await requireUserId(request);
  const revisions = await listExpenseRevisions(id, userId);
  return NextResponse.json({ revisions: revisions.map(serializeRevision) });
});
