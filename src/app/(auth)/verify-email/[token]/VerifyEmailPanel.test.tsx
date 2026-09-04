import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailPanel } from "./VerifyEmailPanel";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

function routedFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.keys(routes).find((path) => url.includes(path));
    if (!match) throw new Error(`unrouted fetch: ${url}`);
    return routes[match]!();
  });
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VerifyEmailPanel token="tok_abc" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

describe("VerifyEmailPanel", () => {
  it("shows the success state and a way into the app", async () => {
    vi.stubGlobal("fetch", routedFetch({ "/api/auth/verify-email": () => new Response(null, { status: 204 }) }));

    renderPanel();

    expect(await screen.findByRole("heading", { name: "Correo verificado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Cuadre" })).toHaveAttribute("href", "/groups");
  });

  it("shows a clear failure with a resend action for an expired token", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/api/auth/verify-email": () =>
          new Response(JSON.stringify({ error: { code: "INVALID_TOKEN", message: "no" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    );

    renderPanel();

    expect(await screen.findByRole("heading", { name: "No pudimos verificar el enlace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar enlace" })).toBeEnabled();
  });

  it("resends from the failure state and confirms", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/api/auth/verify-email": () =>
          new Response(JSON.stringify({ error: { code: "INVALID_TOKEN", message: "no" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        "/api/auth/resend-verification": () => new Response(null, { status: 204 }),
      }),
    );

    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Reenviar enlace" }));

    expect(await screen.findByText("Listo. Revisa tu correo.")).toBeInTheDocument();
  });
});
