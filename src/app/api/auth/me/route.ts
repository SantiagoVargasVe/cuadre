import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "../../../../server/auth/session";
import { UnauthorizedError } from "../../../../server/errors";
import { withErrorHandling } from "../../../../server/http/map-error";
import { getUserById } from "../../../../server/services/auth";

/** groups[] is always empty until T020/T025 give the app a groups table. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const userId = await requireUserId(request);

  const user = await getUserById(userId);
  if (!user) {
    // Session valid but the user row is gone — shouldn't happen (no
    // deletion path exists yet), but "not found" here should still read
    // to the caller as "not logged in", not as a 500.
    throw new UnauthorizedError();
  }

  return NextResponse.json({ user, groups: [] });
});
