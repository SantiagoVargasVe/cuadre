import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailPrompt } from "./VerifyEmailPrompt";

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
    new Response(JSON.stringify({ user: { id: "1", email: "a@b.com", displayName: "Ana", avatar: null, emailVerified } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

function renderPrompt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VerifyEmailPrompt />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("VerifyEmailPrompt", () => {
  it("does not render for a verified account", async () => {
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/me": me(true) }));
    renderPrompt();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/Verifica tu correo/)).not.toBeInTheDocument();
  });

  it("shows for an unverified account and does not block the page", async () => {
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/me": me(false) }));
    renderPrompt();
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(/Verifica tu correo/);
    // A banner, not an overlay — no dialog role, no aria-modal.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resends the verification email and confirms", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/api/auth/me": me(false),
        "/api/auth/resend-verification": () => new Response(null, { status: 204 }),
      }),
    );

    renderPrompt();
    await user.click(await screen.findByRole("button", { name: "Reenviar verificación" }));

    expect(await screen.findByText("Enviado. Revisa tu correo.")).toBeInTheDocument();
  });

  it("reports a rate-limited resend distinctly", async () => {
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

    renderPrompt();
    await user.click(await screen.findByRole("button", { name: "Reenviar verificación" }));

    expect(
      await screen.findByText("Ya enviamos uno hace poco. Intenta más tarde."),
    ).toBeInTheDocument();
  });

  it("stays dismissed for the session and comes back in a new one", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/me": me(false) }));

    const { unmount } = renderPrompt();
    await user.click(await screen.findByRole("button", { name: "Ahora no" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    // Same session (sessionStorage intact) → still gone after a remount.
    unmount();
    renderPrompt();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // New session → back.
    sessionStorage.clear();
    renderPrompt();
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });
});
