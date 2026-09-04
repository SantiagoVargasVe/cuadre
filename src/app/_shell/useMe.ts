"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../lib/api/client";
import type { AvatarChoice } from "../../lib/avatar";

export interface Me {
  id: string;
  email: string;
  displayName: string;
  avatar: AvatarChoice | null;
  /** T124 — whether the account's email address has been confirmed. */
  emailVerified: boolean;
}

interface MeResponse {
  user: Me;
}

/**
 * The one `["me"]` query. The shell (`UserMenu`) and the verification
 * prompt both read it, and TanStack dedupes by key — a second consumer
 * adds no round-trip. A `401` isn't retried (the session is gone;
 * `UserMenu` sends the tab to `/login`).
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 3,
  });
}

/** Ask for a fresh verification email for the signed-in account. */
export function useResendVerification() {
  return useMutation({
    mutationFn: () => apiFetch("/api/auth/resend-verification", { method: "POST" }),
  });
}

/** Whether a failed resend was a rate-limit refusal (`429`), which gets its own copy. */
export function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}
