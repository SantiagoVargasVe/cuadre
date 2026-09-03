import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actionDetail, renderActionFeed, response } from "./expenseActionTestHelpers";

// The feed renders the search/filter bar, which navigates (T115).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("expense edit flow", () => {
  it("prefills and submits a full replacement while preserving split intent", async () => {
    const updated = {
      ...actionDetail,
      title: "Hotel y desayuno",
      version: 2,
      editedAt: "2026-08-25T10:00:00.000Z",
      editedBy: { userId: "ana", displayName: "Ana" },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, actionDetail))
      .mockResolvedValueOnce(response(200, { id: "e1" }))
      .mockResolvedValueOnce(response(200, updated));
    vi.stubGlobal("fetch", fetchMock);
    const invalidate = renderActionFeed();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Hotel/ }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByLabelText("Título")).toHaveValue("Hotel");
    expect(screen.getByLabelText("Monto")).toHaveValue("300.000");
    expect(screen.getByText("Dividido: por partes")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Hotel y desayuno");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toBe("/api/expenses/e1");
    expect(JSON.parse(patchInit.body as string)).toEqual({
      title: "Hotel y desayuno",
      date: "2026-08-24",
      amount: "30000000",
      currency: "COP",
      paidBy: [{ userId: "ana", amount: "30000000" }],
      split: { strategy: "shares", weights: { ana: 2, beto: 1 } },
      category: "alojamiento",
    });
    expect(await screen.findByRole("button", { name: /Hotel y desayuno/ })).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["group", "g1"] });
  });
});
