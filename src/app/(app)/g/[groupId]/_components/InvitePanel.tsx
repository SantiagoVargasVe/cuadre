"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { InviteLink } from "./InviteLink";

const t = es.settings.invite;

/** Mint a join link and hand it over ready to paste into WhatsApp. Any
 * member may mint — no approval step (api-contract.md). */
export function InvitePanel({ groupId }: { groupId: string }) {
  const mint = useMutation({
    mutationFn: () => apiFetch<{ code: string; url: string; expiresAt: string }>(`/api/groups/${groupId}/invites`, { method: "POST", body: {} }),
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>
      {mint.data && <InviteLink key={mint.data.code} url={mint.data.url} expiresAt={mint.data.expiresAt} />}
      <Button type="button" onClick={() => mint.mutate()} disabled={mint.isPending} className="min-h-11 self-start">
        {mint.isPending ? t.minting : mint.data ? t.mintAnother : t.mint}
      </Button>
      {mint.isError && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
    </section>
  );
}
