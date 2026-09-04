"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import { isRateLimited, useResendVerification } from "../../../_shell/useMe";
import { Button } from "../../../_ui/Button";

const t = es.auth.verifyEmail;

/**
 * Consumes the token on load and shows the outcome. Never a dead end: a
 * failed verification offers a resend, and a logged-out visitor who tries
 * to resend is sent to `/login` (resend is authenticated).
 */
export function VerifyEmailPanel({ token }: { token: string }) {
  const router = useRouter();
  const resend = useResendVerification();

  const verify = useQuery({
    queryKey: ["verify-email", token],
    // The endpoint answers 204, so `apiFetch` resolves `undefined` — return
    // a sentinel, since TanStack Query rejects `undefined` query data.
    queryFn: async () => {
      await apiFetch("/api/auth/verify-email", { method: "POST", body: { token } });
      return "verified" as const;
    },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (verify.isPending) {
    return <p className="text-sm text-muted-foreground">{t.verifying}</p>;
  }

  if (verify.isSuccess) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t.successTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.successBody}</p>
        <Link href="/groups" className="text-sm text-primary underline">
          {t.goToApp}
        </Link>
      </div>
    );
  }

  const resendStatus = resend.isSuccess
    ? t.resent
    : resend.isError && !isRateLimited(resend.error)
      ? t.resendError
      : null;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-foreground">{t.errorTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.errorBody}</p>
      {resendStatus && (
        <p role="alert" className="text-sm text-muted-foreground">
          {resendStatus}
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={resend.isPending || resend.isSuccess}
        onClick={() =>
          resend.mutate(undefined, {
            onError: (error) => {
              if (error instanceof ApiError && error.status === 401) router.push("/login");
            },
          })
        }
      >
        {resend.isPending ? t.resending : t.resend}
      </Button>
    </div>
  );
}
