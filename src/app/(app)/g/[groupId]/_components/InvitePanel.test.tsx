import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitePanel } from "./InvitePanel";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("InvitePanel", () => {
  it("mints a link and copies it to the clipboard", async () => {
    const url = "https://cuadre.example/join/abc123";
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const nextUrl = "https://cuadre.example/join/def456";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, { code: "abc123", url, expiresAt }))
      .mockResolvedValueOnce(jsonResponse(201, { code: "def456", url: nextUrl, expiresAt }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    // After setup(): userEvent installs its own clipboard stub, so override it here.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <InvitePanel groupId="g1" />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Crear enlace de invitación" }));

    const field = await screen.findByLabelText("Enlace de invitación");
    expect(field).toHaveValue(url);
    expect(screen.getByText(/Durante 24 horas, varias personas/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Válido hasta");
    expect(screen.getByRole("status").querySelector("time")).toHaveAttribute("datetime", expiresAt);

    await user.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(await screen.findByRole("button", { name: "¡Copiado!" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Crear otro enlace de invitación" }));
    await waitFor(() => expect(screen.getByLabelText("Enlace de invitación")).toHaveValue(nextUrl));
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
