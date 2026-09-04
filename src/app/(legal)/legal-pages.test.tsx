import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDate } from "../../lib/date/format";
import { LEGAL_DOCUMENTS } from "../../lib/legal";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

afterEach(() => vi.unstubAllGlobals());

describe("public legal pages", () => {
  it("renders the versioned Terms without auth or a network request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Términos de servicio" })).toBeInTheDocument();
    // The label the page shows is the single source of truth registration records against.
    expect(screen.getByText(`Versión ${LEGAL_DOCUMENTS.terms.version}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`Vigente desde el ${formatCalendarDate(LEGAL_DOCUMENTS.terms.effectiveDate)}`),
      ),
    ).toBeInTheDocument();
    expect(termsMetadata.title).toBe("Términos de servicio — Cuadre");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("states the post-recovery reality: verification is sent, optional, and only gates reset", () => {
    render(<TermsPage />);

    expect(screen.getByText(/Cuadre envía un mensaje de verificación a tu correo/)).toBeInTheDocument();
    expect(screen.getByText(/una cuenta sin verificar puede usar la aplicación con normalidad/)).toBeInTheDocument();
    expect(
      screen.getByText(/el Operador puede generarte un enlace de restablecimiento/),
    ).toBeInTheDocument();
  });

  it("renders the versioned Privacy Policy and its rights procedure", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidad" })).toBeInTheDocument();
    expect(screen.getByText(`Versión ${LEGAL_DOCUMENTS.privacy.version}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "7. Tus derechos" })).toBeInTheDocument();
    expect(screen.getByText(/contacta al Operador por el canal/)).toBeInTheDocument();
    expect(privacyMetadata.title).toBe("Política de privacidad — Cuadre");
  });

  it("names the email processor, is exact about what it receives, and keeps the FX statement", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/Cuadre entrega tu dirección de correo y un enlace a un proveedor de entrega de email/),
    ).toBeInTheDocument();
    expect(screen.getByText(/no recibe nombres de grupos, listas de integrantes, montos ni saldos/)).toBeInTheDocument();
    // The pre-existing FX promise stays true and stays on the page.
    expect(
      screen.getByText(/No se envían datos del usuario al proveedor diario de tasas de cambio/),
    ).toBeInTheDocument();
    // Verification status is private to the account holder (ADR-0013).
    expect(screen.getByText(/el estado de verificación es visible únicamente para el titular/)).toBeInTheDocument();
  });
});
