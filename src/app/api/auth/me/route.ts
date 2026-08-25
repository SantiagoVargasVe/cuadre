import { NextResponse, type NextRequest } from "next/server";
import { requireUserId, UnauthorizedError } from "../../../../server/auth/session";
import { getUserById } from "../../../../server/services/auth";

/** groups[] is always empty until T020/T025 give the app a groups table. */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    throw error;
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  return NextResponse.json({ user, groups: [] });
}
