import type { Metadata } from "next";
import { VerifyEmailPanel } from "./VerifyEmailPanel";

export const metadata: Metadata = { title: "Verificar correo — Cuadre" };

/**
 * `/verify-email/[token]` — in the `(auth)` group, so it renders the
 * centered card with no session required: people open the mail on a
 * device they haven't signed in on.
 */
export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VerifyEmailPanel token={token} />;
}
