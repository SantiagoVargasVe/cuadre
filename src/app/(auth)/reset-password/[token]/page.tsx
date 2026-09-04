import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * `referrer: no-referrer` because the URL carries a live single-use
 * credential in its path — it must never leak to a third party via a
 * `Referer` header. The page also makes no third-party request of its own
 * (no remote font, no analytics, no remote image); keep it that way.
 */
export const metadata: Metadata = {
  title: "Nueva contraseña — Cuadre",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ResetPasswordForm token={token} />;
}
