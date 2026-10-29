import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinView } from "./JoinView";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

describe("JoinView", () => {
  it("registers a new account with the shared invite directly from its join page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: "new-friend" } }), {
      status: 201, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<JoinView code="SHARED123" invite={{ valid: true, groupTitle: "Guatemala", inviterName: "Ana" }} isLoggedIn={false} />);
    await user.type(screen.getByLabelText("Correo electrónico"), "caro@example.com");
    await user.type(screen.getByLabelText("Nombre"), "Caro");
    await user.type(screen.getByLabelText("Contraseña"), "correct horse battery staple");
    await user.click(screen.getByRole("checkbox", { name: /Términos de servicio/ }));
    await user.click(screen.getByRole("checkbox", { name: /Política de privacidad/ }));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/register");
    expect(JSON.parse(init.body as string)).toMatchObject({ email: "caro@example.com", inviteCode: "SHARED123" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
  });

  it("shows the invalid message and a login link when the invite isn't valid", () => {
    render(<JoinView code="dead" invite={{ valid: false }} isLoggedIn={false} />);

    expect(screen.getByText("Invitación no válida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
  });

  it("greets by group title when logged out, and prefills the register form's invite code", () => {
    render(
      <JoinView
        code="ABC123"
        invite={{ valid: true, groupTitle: "Cartagena 2026", inviterName: "Ana", expiresAt: "2030-01-11T12:00:00Z" }}
        isLoggedIn={false}
      />,
    );

    expect(screen.getByText("Ana te invitó a Cartagena 2026")).toBeInTheDocument();
    const field = screen.getByLabelText("Código de invitación") as HTMLInputElement;
    expect(field.value).toBe("ABC123");
    expect(screen.getByRole("link", { name: "Inicia sesión" })).toHaveAttribute("href", "/login?next=%2Fjoin%2FABC123");
    expect(screen.getByText(/Invitación válida hasta/)).toBeInTheDocument();
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
