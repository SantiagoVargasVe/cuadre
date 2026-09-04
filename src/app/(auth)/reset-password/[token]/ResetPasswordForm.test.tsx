import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./ResetPasswordForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

function jsonResponse(status: number, body: unknown = null) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fill(user: ReturnType<typeof userEvent.setup>, pw: string, confirm = pw) {
  await user.type(screen.getByLabelText("Nueva contraseña"), pw);
  await user.type(screen.getByLabelText("Repite la contraseña"), confirm);
}

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

describe("ResetPasswordForm", () => {
  it("validates the password against registration's rule and the confirmation match", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok" />);

    await fill(user, "short", "short");
    expect(await screen.findByText("La contraseña debe tener al menos 8 caracteres.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Repite la contraseña"));
    await user.type(screen.getByLabelText("Nueva contraseña"), "a strong new passphrase");
    await user.type(screen.getByLabelText("Repite la contraseña"), "different one");
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });

  it("submits and redirects to /login with a deliberate not-logged-in state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(204)));
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok" />);

    await fill(user, "a strong new passphrase");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?reset=1"));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  });

  it("renders a way forward, not a dead end, when the token is invalid or expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: "INVALID_TOKEN", message: "no" } })),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok" />);

    await fill(user, "a strong new passphrase");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("heading", { name: "El enlace no sirve" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir un enlace nuevo" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables submit while in flight so a double submit can't burn the token", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r))));
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok" />);

    await fill(user, "a strong new passphrase");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolve(jsonResponse(204));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
  });
});
