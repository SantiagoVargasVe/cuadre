import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActionFeed, response, stubRoutes } from "./expenseActionTestHelpers";

// The feed renders the search/filter bar, which navigates (T115).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

async function openDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Hotel/ }));
  await user.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(await screen.findByText(/¿Eliminar “Hotel”/)).toBeInTheDocument();
}

describe("expense delete flow", () => {
  it("removes the row after confirmation and invalidates expenses and balances", async () => {
    const fetchMock = stubRoutes({
      "DELETE /api/expenses/e1": () => response(204),
      // The feed re-reads rather than dropping the row locally (T117).
      "GET /api/groups/g1/expenses": () => response(200, { items: [], nextCursor: null }),
    });
    const invalidate = renderActionFeed();
    const user = userEvent.setup();
    await openDelete(user);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("Aún no hay gastos")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses/e1", expect.objectContaining({ method: "DELETE" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["group", "g1"] });
  });

  it("keeps the row and shows an error when deletion fails", async () => {
    stubRoutes({
      "DELETE /api/expenses/e1": () =>
        response(500, { error: { code: "INTERNAL_ERROR", message: "No" } }),
    });
    renderActionFeed();
    const user = userEvent.setup();
    await openDelete(user);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo eliminar el gasto");
    await waitFor(() => expect(screen.getByText(/¿Eliminar “Hotel”/)).toBeInTheDocument());
  });
});
