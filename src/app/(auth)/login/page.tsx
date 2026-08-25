import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión — Cuadre" };

export default function LoginPage() {
  return <LoginForm />;
}
