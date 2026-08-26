import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinView } from "./JoinView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JoinView", () => {
  it("shows the invalid message and a login link when the invite isn't valid", () => {
    render(<JoinView code="dead" invite={{ valid: false }} isLoggedIn={false} />);

    expect(screen.getByText("Invitación no válida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
  });

  it("greets by group title when logged out, and prefills the register form's invite code", () => {
    render(
      <JoinView
        code="ABC123"
        invite={{ valid: true, groupTitle: "Cartagena 2026", inviterName: "Ana" }}
        isLoggedIn={false}
      />,
    );

    expect(screen.getByText("Ana te invitó a Cartagena 2026")).toBeInTheDocument();
    const field = screen.getByLabelText("Código de invitación") as HTMLInputElement;
    expect(field.value).toBe("ABC123");
  });

  it("falls back to a generic greeting for a plain invite with no group", () => {
    render(<JoinView code="ABC123" invite={{ valid: true, inviterName: "Ana" }} isLoggedIn={false} />);
    expect(screen.getByText("Ana te invitó a Cuadre")).toBeInTheDocument();
  });

  it("falls back to 'Alguien' when inviterName is null (the bootstrap code)", () => {
    render(<JoinView code="ABC123" invite={{ valid: true, inviterName: null }} isLoggedIn={false} />);
    expect(screen.getByText("Alguien te invitó a Cuadre")).toBeInTheDocument();
  });

  it("shows a join button instead of the register form when already logged in", () => {
    render(
      <JoinView
        code="ABC123"
        invite={{ valid: true, groupTitle: "Cartagena 2026", inviterName: "Ana" }}
        isLoggedIn={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Unirme al grupo" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de invitación")).not.toBeInTheDocument();
  });
});
