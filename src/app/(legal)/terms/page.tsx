import type { Metadata } from "next";
import { es } from "../../../lib/i18n/es";
import { LegalDocument } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: `${es.legal.terms.title} — Cuadre`,
  description: es.legal.terms.description,
};

export default function TermsPage() {
  return <LegalDocument document="terms" />;
}
