import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError, apiFetchServer } from "../../../../lib/api/server";
import type { GroupDetailResult } from "./_components/types";

interface MeResponse {
  user: { id: string };
}

/**
 * Request-scoped loaders for the two things *every* group tab needs — the
 * group detail and the caller's id. `React.cache` collapses the layout's
 * call and the page's call (and any repeat) into one loopback round trip
 * per render pass (T106). `cache: "no-store"` still holds inside
 * `apiFetchServer` — this dedupes within one request, it does not persist
 * one member's data into another's response.
 *
 * The tab-specific reads (`/expenses`, `/balances`, `/settlements`,
 * `/members`, `/display-currency`) are not here: each is fetched by exactly
 * one page, so there is nothing to dedupe.
 */

/**
 * `GET /api/groups/:id`. A 404 means "not a member" (api-contract.md:
 * non-membership is 404, not 403) → bounce to `/groups`, server-side and
 * before the tab renders. This replaces the client-side bounce
 * `GroupHeading` used to do after its own fetch.
 */
export const getGroupDetail = cache(async (groupId: string): Promise<GroupDetailResult> => {
  try {
    return await apiFetchServer<GroupDetailResult>(`/api/groups/${groupId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) redirect("/groups");
    throw error;
  }
});

/** `GET /api/auth/me`. */
export const getMe = cache((): Promise<MeResponse> => apiFetchServer<MeResponse>("/api/auth/me"));
