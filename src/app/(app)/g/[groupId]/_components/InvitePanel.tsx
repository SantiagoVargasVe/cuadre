"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";

const t = es.settings.invite;

/** Mint a join link and hand it over ready to paste into WhatsApp. Any
 * member may mint — no approval step (api-contract.md). */
export function InvitePanel({ groupId }: { groupId: string }) {
  const [copied, setCopied] = React.useState(false);
  const mint = useMutation({
    mutationFn: () => apiFetch<{ code: string; url: string }>(`/api/groups/${groupId}/invites`, { method: "POST", body: {} }),
    onSuccess: () => setCopied(false),
  });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>
      {mint.data ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={mint.data.url}
            aria-label={t.linkLabel}
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button type="button" variant="secondary" onClick={() => copy(mint.data!.url)}>
            {copied ? t.copied : t.copy}
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => mint.mutate()} disabled={mint.isPending} className="self-start">
          {mint.isPending ? t.minting : t.mint}
        </Button>
      )}
      {mint.isError && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
    </section>
  );
}
