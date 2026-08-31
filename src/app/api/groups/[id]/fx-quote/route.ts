import { NextResponse, type NextRequest } from "next/server";
import { fxQuoteQuerySchema } from "../../../../../lib/schemas/fx";
import { requireUserId } from "../../../../../server/auth/session";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { quoteRate } from "../../../../../server/services/fx";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/groups/:id/fx-quote?from=USD&to=COP` — a read-only rate quote
 * for an arbitrary pair so the settle-up form can name the transfer amount
 * (T104). Member-only (enforced in `quoteRate`), never writes a pin.
 * `RATE_UNAVAILABLE` (from `ensureRate`) when today's rate can't be had,
 * naming the pair — the form drops its helper rather than showing a stale
 * number.
 */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { id: groupId } = await context.params;
  const userId = await requireUserId(request);

  const url = new URL(request.url);
  const parsed = fxQuoteQuerySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" } },
      { status: 400 },
    );
  }

  const quote = await quoteRate(groupId, userId, parsed.data.from, parsed.data.to);
  return NextResponse.json(quote);
});
