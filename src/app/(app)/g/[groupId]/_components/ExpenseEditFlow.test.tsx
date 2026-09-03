import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actionDetail, renderActionFeed, response, stubRoutes } from "./expenseActionTestHelpers";

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
    let detailReads = 0;
    const fetchMock = stubRoutes({
      // Read once to prefill the form, then again for the saved summary.
      "GET /api/expenses/e1": () => response(200, detailReads++ === 0 ? actionDetail : updated),
      "PATCH /api/expenses/e1": () => response(200, { id: "e1" }),
      // The row's new title arrives from the feed's own re-read (T117),
      // not from a local patch of the list.
      "GET /api/groups/g1/expenses": () =>
        response(200, { items: [updated], nextCursor: null }),
    });
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

    const patchCall = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
      expect(call).toBeDefined();
      return call as [string, RequestInit];
    });
    const [patchUrl, patchInit] = patchCall;
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
