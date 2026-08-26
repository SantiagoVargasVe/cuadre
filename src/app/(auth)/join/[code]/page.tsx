import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSessionFromCookies } from "../../../../server/auth/session";
import { requireNotLimited } from "../../../../server/rate-limit";
import { clientIp } from "../../../../server/rate-limit/client-ip";
import { policies } from "../../../../server/rate-limit/policies";
import { lookupInvite } from "../../../../server/services/invites";
import { JoinView } from "./JoinView";

export const metadata: Metadata = { title: "Unirse a un grupo — Cuadre" };

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Calls lookupInvite() directly instead of fetching GET /api/invites/:code
 * — same data, no extra round trip, and it lets a Server Component read
 * the session cookie for the logged-in/out branch in the same pass. That
 * bypasses the API route's own rate limit, so this applies the identical
 * `invite-lookup:<ip>` bucket itself rather than leaving the page as an
 * unlimited enumeration path (security.md § Invite codes).
 */
export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  const headersList = await headers();
  await requireNotLimited(policies.inviteLookup, `invite-lookup:${clientIp(headersList)}`);

  const [invite, session] = await Promise.all([lookupInvite(code), getSessionFromCookies()]);

  return <JoinView code={code} invite={invite} isLoggedIn={Boolean(session)} />;
}
