import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvatarChoice } from "../../../../lib/avatar";
import { AvatarEditor } from "./AvatarEditor";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderEditor(current: AvatarChoice | null = null) {
  const writes: { method: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    writes.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
    return jsonResponse(200, { avatar: null });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AvatarEditor userId="u-1" current={current} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), writes };
}

/** The variant name text is stable across a reroll; the SVG geometry is not. */
const geometry = () =>
  [...document.querySelectorAll("svg path, svg rect")]
    .map((el) => el.getAttribute("d") ?? el.getAttribute("transform") ?? "")
    .join("|");

describe("AvatarEditor (T108)", () => {
  it("writes nothing until Guardar, then PUTs the chosen variant/seed/palette", async () => {
    const { user, writes } = renderEditor();

    await user.click(screen.getByRole("button", { name: /Elegir el estilo pixel/ }));
    await user.click(screen.getByRole("button", { name: "Fríos" }));
    expect(writes).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.method).toBe("PUT");
    expect(writes[0]!.body).toMatchObject({ variant: "pixel", palette: "cool" });
    expect(String((writes[0]!.body as AvatarChoice).seed)).toMatch(/^[A-Za-z0-9_-]{6,24}$/);
  });

  it("'otra' rerolls the whole grid to a new seed", async () => {
    const { user } = renderEditor();
    const before = geometry();

    await user.click(screen.getByRole("button", { name: "Otra" }));

    expect(geometry()).not.toBe(before);
    // The six variant names are still all there — nothing dropped.
    for (const name of ["Mármol", "Caritas", "Píxeles", "Atardecer", "Anillos", "Bauhaus"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("'usar el predeterminado' PUTs null and does not need Guardar", async () => {
    const { user, writes } = renderEditor({ variant: "ring", seed: "seedabc", palette: "warm" });

    await user.click(screen.getByRole("button", { name: "Usar el predeterminado" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({ method: "PUT", body: null });
  });
});
