"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ApiError, apiFetch } from "../../lib/api/client";

interface GroupResponse {
  group: { id: string; title: string };
}

/**
 * The group name for the header — "where relevant" per T060's acceptance
 * criteria, i.e. only on /g/[groupId]. A 404 here means the visitor isn't a
 * member (api-contract.md: non-membership is 404, not 403), so it bounces
 * to /groups rather than showing an error for a group that, from this
 * user's point of view, doesn't exist.
 */
export function GroupHeading({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { data, error } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiFetch<GroupResponse>(`/api/groups/${groupId}`),
    retry: false,
  });

  React.useEffect(() => {
    if (error instanceof ApiError && error.status === 404) {
      router.replace("/groups");
    }
  }, [error, router]);

  return (
    <h1 className="truncate text-xl font-semibold text-foreground" aria-live="polite">
      {data?.group.title ?? " "}
    </h1>
  );
}
