import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./RegisterForm";

const pushMock = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
  searchParamsMock.mockReturnValue(new URLSearchParams());
});

describe("RegisterForm", () => {
  it("prefills inviteCode from ?code= while keeping the field editable", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("code=ABC123XYZ"));
    render(<RegisterForm />);

    const field = screen.getByLabelText("Código de invitación") as HTMLInputElement;
    expect(field.value).toBe("ABC123XYZ");
    expect(field).not.toHaveAttribute("readonly");
    expect(field).not.toBeDisabled();
  });

  it("renders a duplicate-email error against the email field, not as a form banner", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("code=ABC123XYZ"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(409, {
            error: { code: "EMAIL_ALREADY_REGISTERED", message: "Email is already registered" },
          }),
        ),
    );
    const user = userEvent.setup();

    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Contraseña"), "correct horse battery staple");
    await user.click(screen.getByRole("checkbox", { name: /Términos de servicio/ }));
    await user.click(screen.getByRole("checkbox", { name: /Política de privacidad/ }));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Ese correo ya está registrado.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an invalid-invite error against the invite code field", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("code=EXPIRED123"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          error: {
            code: "INVALID_INVITE_CODE",
            message: "Invite code is invalid, expired, or already used",
          },
        }),
      ),
    );
    const user = userEvent.setup();

    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Contraseña"), "correct horse battery staple");
    await user.click(screen.getByRole("checkbox", { name: /Términos de servicio/ }));
    await user.click(screen.getByRole("checkbox", { name: /Política de privacidad/ }));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("El código de invitación no es válido o ya fue usado."),
    ).toBeInTheDocument();
  });
});
