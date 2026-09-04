import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./RegisterForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("code=ABC123XYZ"),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
  await user.type(screen.getByLabelText("Nombre"), "Ana");
  await user.type(screen.getByLabelText("Contraseña"), "correct horse battery staple");
}

describe("RegisterForm legal acknowledgements", () => {
  it("shows separate accessible controls and public document links", () => {
    render(<RegisterForm />);

    expect(screen.getByRole("checkbox", { name: /Términos de servicio/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Política de privacidad/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: /Términos de servicio/ })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /Política de privacidad/ })).toHaveAttribute("href", "/privacy");
  });

  it("keeps registration disabled until both acknowledgements are checked", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillRequiredFields(user);

    const submit = screen.getByRole("button", { name: "Crear cuenta" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Términos de servicio/ }));
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Política de privacidad/ }));
    expect(submit).toBeEnabled();
  });

  it("submits both explicit acknowledgement values with the account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("checkbox", { name: /Términos de servicio/ }));
    await user.click(screen.getByRole("checkbox", { name: /Política de privacidad/ }));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/register");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "ana@example.com",
      displayName: "Ana",
      password: "correct horse battery staple",
      inviteCode: "ABC123XYZ",
      termsAccepted: true,
      privacyAccepted: true,
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
  });

  it("gives each unchecked acknowledgement its own validation message", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const terms = screen.getByRole("checkbox", { name: /Términos de servicio/ });
    const privacy = screen.getByRole("checkbox", { name: /Política de privacidad/ });
    await user.click(terms);
    await user.click(terms);
    await user.click(privacy);
    await user.click(privacy);

    expect(await screen.findByText("Debes aceptar los Términos de servicio.")).toBeInTheDocument();
    expect(screen.getByText(/Debes autorizar el tratamiento descrito/)).toBeInTheDocument();
  });
});
