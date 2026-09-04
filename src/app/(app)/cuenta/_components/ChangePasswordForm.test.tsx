import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./ChangePasswordForm";

function jsonResponse(status: number, body: unknown = null) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  current = "old passphrase",
  next = "a fresh new passphrase",
  confirm = next,
) {
  await user.type(screen.getByLabelText("Contraseña actual"), current);
  await user.type(screen.getByLabelText("Nueva contraseña"), next);
  await user.type(screen.getByLabelText("Repite la nueva contraseña"), confirm);
}

afterEach(() => vi.unstubAllGlobals());

describe("ChangePasswordForm", () => {
  it("holds the new password to registration's rule and the confirmation match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user, "old passphrase", "short", "short");
    expect(await screen.findByText("La contraseña debe tener al menos 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar contraseña" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Nueva contraseña"));
    await user.type(screen.getByLabelText("Nueva contraseña"), "a fresh new passphrase");
    await user.clear(screen.getByLabelText("Repite la nueva contraseña"));
    await user.type(screen.getByLabelText("Repite la nueva contraseña"), "something else");
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });

  it("confirms success and clears the fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(204)));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(
      await screen.findByText(/Contraseña actualizada\. Se cerró la sesión en los demás dispositivos\./),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
  });

  it("maps a wrong current password to its own Spanish message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "no" } }),
      ),
    );
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña actual no es correcta.");
  });

  it("disables submit while the request is in flight", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r))));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolve(jsonResponse(204));
    await waitFor(() => expect(screen.getByLabelText("Contraseña actual")).toHaveValue(""));
  });
});
