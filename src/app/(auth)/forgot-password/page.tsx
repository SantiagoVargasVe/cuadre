import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Restablecer contraseña — Cuadre" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
