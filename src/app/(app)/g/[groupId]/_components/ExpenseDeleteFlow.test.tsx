import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActionFeed, response } from "./expenseActionTestHelpers";

afterEach(() => vi.unstubAllGlobals());

async function openDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Hotel/ }));
  await user.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(await screen.findByText(/¿Eliminar “Hotel”/)).toBeInTheDocument();
}

describe("expense delete flow", () => {
  it("removes the row after confirmation and invalidates expenses and balances", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const invalidate = renderActionFeed();
    const user = userEvent.setup();
    await openDelete(user);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("Aún no hay gastos")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses/e1", expect.objectContaining({ method: "DELETE" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["group", "g1"] });
  });

  it("keeps the row and shows an error when deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(500, {
      error: { code: "INTERNAL_ERROR", message: "No" },
    })));
    renderActionFeed();
    const user = userEvent.setup();
    await openDelete(user);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo eliminar el gasto");
    await waitFor(() => expect(screen.getByText(/¿Eliminar “Hotel”/)).toBeInTheDocument());
  });
});
