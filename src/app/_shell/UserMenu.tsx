"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { apiFetch } from "../../lib/api/client";
import { es } from "../../lib/i18n/es";
import { Button } from "../_ui/Button";

const t = es.nav;

interface MeResponse {
  user: { id: string; email: string; displayName: string };
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
    <div className="flex items-center gap-3">
      {data && (
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {data.user.displayName}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? t.loggingOut : t.logout}
      </Button>
    </div>
  );
}
