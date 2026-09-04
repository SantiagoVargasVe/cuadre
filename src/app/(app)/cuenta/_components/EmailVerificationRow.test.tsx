import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailVerificationRow } from "./EmailVerificationRow";

function routedFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.keys(routes).find((path) => url.includes(path));
    if (!match) throw new Error(`unrouted fetch: ${url}`);
    return routes[match]!();
  });
}

function me(emailVerified: boolean) {
  return () =>
    new Response(
      JSON.stringify({ user: { id: "1", email: "a@b.com", displayName: "Ana", avatar: null, emailVerified } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EmailVerificationRow />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("EmailVerificationRow", () => {
  it("shows a plain verified label with no resend control", async () => {
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/me": me(true) }));
    renderRow();

    expect(await screen.findByText("Correo verificado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the consequence and a resend control when unverified", async () => {
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/me": me(false) }));
    renderRow();

    expect(await screen.findByText("Correo sin verificar")).toBeInTheDocument();
    expect(screen.getByText(/poder restablecer tu contraseña por tu cuenta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar verificación" })).toBeEnabled();
  });

  it("surfaces a rate-limited resend as its own message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/api/auth/me": me(false),
        "/api/auth/resend-verification": () =>
          new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "no" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    );
    renderRow();

    await user.click(await screen.findByRole("button", { name: "Reenviar verificación" }));
    expect(await screen.findByText("Ya enviamos uno hace poco. Intenta más tarde.")).toBeInTheDocument();
  });
});
