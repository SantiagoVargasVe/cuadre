import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

function jsonResponse(status: number, body: unknown = null) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ForgotPasswordForm", () => {
  it("keeps submit disabled until the email is valid", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    const submit = screen.getByRole("button", { name: "Enviar enlace" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Correo electrónico"), "not-an-email");
    expect(await screen.findByText("Correo electrónico inválido.")).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("shows an address-agnostic success state, never 'revisa tu correo'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(202)));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(
      await screen.findByText(/Si esa dirección está registrada/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/revisa tu correo/i)).not.toBeInTheDocument();
    // The verified-address condition is surfaced here, worded as a condition.
    expect(screen.getByText(/necesita un correo verificado/)).toBeInTheDocument();
  });

  it("disables submit while the request is in flight", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r))));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();
    resolve(jsonResponse(202));
    await screen.findByText(/Si esa dirección está registrada/);
  });

  it("surfaces a rate-limit refusal with keyed copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(429, { error: { code: "RATE_LIMITED", message: "no" } })),
    );
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos.");
  });
});
