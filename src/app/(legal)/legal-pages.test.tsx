import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

afterEach(() => vi.unstubAllGlobals());

describe("public legal pages", () => {
  it("renders the versioned Terms without auth or a network request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Términos de servicio" })).toBeInTheDocument();
    expect(screen.getByText("Versión 2026-09-03")).toBeInTheDocument();
    expect(screen.getByText(/Vigente desde el 3 de sept de 2026/)).toBeInTheDocument();
    expect(termsMetadata.title).toBe("Términos de servicio — Cuadre");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the versioned Privacy Policy and its rights procedure", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidad" })).toBeInTheDocument();
    expect(screen.getByText("Versión 2026-09-03")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "7. Tus derechos" })).toBeInTheDocument();
    expect(screen.getByText(/contacta al Operador por el canal/)).toBeInTheDocument();
    expect(privacyMetadata.title).toBe("Política de privacidad — Cuadre");
  });
});
