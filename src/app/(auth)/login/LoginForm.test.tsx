import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const pushMock = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubSuccessfulLogin() {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { user: { id: "1", email: "ana@example.com", displayName: "Ana" } }),
      ),
  );
}

async function submitValidLogin() {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "correct horse battery staple");
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
  searchParams = new URLSearchParams();
});

describe("LoginForm", () => {
  it("submit is disabled while the form is invalid", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeDisabled();
  });

  it("submits the entered email and password to the login endpoint", async () => {
    stubSuccessfulLogin();
    await submitValidLogin();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "ana@example.com",
      password: "correct horse battery staple",
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
  });

  it("returns to the ?next= destination after a successful login", async () => {
    searchParams = new URLSearchParams({ next: "/g/some-group/balances" });
    stubSuccessfulLogin();
    await submitValidLogin();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/g/some-group/balances"));
  });

  it("ignores an off-site ?next= and falls back to /groups", async () => {
    searchParams = new URLSearchParams({ next: "https://evil.example.com" });
    stubSuccessfulLogin();
    await submitValidLogin();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
  });

  it("renders a field-level error for an invalid email before ever submitting", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "not-an-email");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.tab();

    expect(await screen.findByText("Correo electrónico inválido.")).toBeInTheDocument();
  });

  it("shows the mapped Spanish message for invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, {
            error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
          }),
        ),
    );

    await submitValidLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
  });
});
