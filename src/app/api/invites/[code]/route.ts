import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { requireNotLimited } from "../../../../server/rate-limit";
import { withErrorHandling } from "../../../../server/http/map-error";
import { lookupInvite } from "../../../../server/services/invites";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Unauthenticated — the register/join page needs this before anyone has an
 * account. Rate limited by IP: unauthenticated and enumerable-looking even
 * at 16 chars of nanoid (security.md). `/join/[code]` calls
 * services/invites.ts directly rather than fetching this route, but shares
 * the exact same `invite-lookup:<ip>` bucket so that path can't bypass it.
 */
export const GET = withErrorHandling(async (request: NextRequest, context: RouteContext) => {
  const { code } = await context.params;
  await requireNotLimited(policies.inviteLookup, `invite-lookup:${clientIp(request.headers)}`);

  const result = await lookupInvite(code);
  return NextResponse.json(result);
});
