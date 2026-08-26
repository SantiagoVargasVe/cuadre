"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import { Button } from "../../../_ui/Button";

const t = es.join;

/** Logged-in path: no form, just consume the code and land in /groups. */
export function JoinAccept({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/invites/${code}/accept`, { method: "POST" });
      router.push("/groups");
    } catch (caught) {
      // Already a member of the group this code points to isn't a failure
      // from the user's point of view — they're already where they wanted
      // to be, so land them there instead of showing an error.
      if (caught instanceof ApiError && caught.code === "ALREADY_A_MEMBER") {
        router.push("/groups");
        return;
      }
      setError(t.errors.generic);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={onJoin} disabled={pending}>
        {pending ? t.joining : t.joinButton}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
