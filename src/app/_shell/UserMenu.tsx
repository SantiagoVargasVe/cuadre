"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { apiFetch } from "../../lib/api/client";
import { es } from "../../lib/i18n/es";
import { Avatar } from "../_ui/Avatar";
import { Button } from "../_ui/Button";

const t = es.nav;

interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatar: import("../../lib/avatar").AvatarChoice | null;
  };
}

/** Displays the current user's name and signs them out. No dropdown — just
 * a name and a button, since Base UI has no Menu primitive on the app's
 * approved list and this doesn't need one yet. */
export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
  });

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      queryClient.clear();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {data && (
        <Link
          href="/cuenta"
          className="flex items-center gap-2 rounded-md hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t.account}
        >
          <Avatar userId={data.user.id} avatar={data.user.avatar} size={24} />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {data.user.displayName}
          </span>
        </Link>
      )}
      <Button variant="ghost" size="sm" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? t.loggingOut : t.logout}
      </Button>
    </div>
  );
}
