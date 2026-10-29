"use client";

import { useEffect, useState } from "react";
import { LocalDateTime } from "../../../../_ui/LocalDateTime";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";

const t = es.settings.invite;

export function InviteLink({ url, expiresAt }: { url: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(() => Date.parse(expiresAt) <= Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly value={url} aria-label={t.linkLabel}
          className="h-11 min-w-0 flex-none rounded-md border border-input bg-background px-3 text-sm text-foreground sm:flex-1"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="secondary" className="min-h-11" disabled={expired} onClick={copy}>
          {copied ? t.copied : t.copy}
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {expired ? t.expired : <>{t.expiresAt} <LocalDateTime value={expiresAt} /></>}
      </p>
    </div>
  );
}
