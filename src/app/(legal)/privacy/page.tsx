import type { Metadata } from "next";
import { es } from "../../../lib/i18n/es";
import { LegalDocument } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: `${es.legal.privacy.title} — Cuadre`,
  description: es.legal.privacy.description,
};

export default function PrivacyPage() {
  return <LegalDocument document="privacy" />;
}
