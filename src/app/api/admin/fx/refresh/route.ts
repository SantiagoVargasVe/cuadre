import { NextResponse, type NextRequest } from "next/server";
import { config } from "../../../../../server/config";
import { NotFoundError, UnauthorizedError } from "../../../../../server/errors";
import { hashTokenForRateLimit, timingSafeTokenEqual } from "../../../../../server/fx/token";
import { withErrorHandling } from "../../../../../server/http/map-error";
import { requireNotLimited } from "../../../../../server/rate-limit";
import { policies } from "../../../../../server/rate-limit/policies";
import { refreshRates } from "../../../../../server/services/fx";

function extractBearerToken(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

/**
 * `FX_REFRESH_TOKEN` unset → `404`, not `401`: a misconfigured deploy
 * fails closed instead of exposing an open endpoint (ADR-0008,
 * security.md). Rate limited **by the token's hash**, not by IP — this
 * has exactly one legitimate caller (the systemd timer) sharing one
 * secret, so bucketing by the token is what actually protects it; an
 * attacker guessing tokens gets a fresh bucket per guess either way.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!config.FX_REFRESH_TOKEN) throw new NotFoundError();

  const token = extractBearerToken(request);
  if (!token || !timingSafeTokenEqual(token, config.FX_REFRESH_TOKEN)) {
    throw new UnauthorizedError();
  }

  await requireNotLimited(policies.fxRefresh, `fx-refresh:${hashTokenForRateLimit(token)}`);

  const result = await refreshRates();
  return NextResponse.json(result);
});
