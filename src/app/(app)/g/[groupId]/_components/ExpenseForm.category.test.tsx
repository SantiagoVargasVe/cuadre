import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fillTitleAndAmount, renderForm, stubCreateThenFetch } from "./expenseFormTestHelpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** T090: the category picker is optional and must never slow the
 * title/amount/save path. */
describe("ExpenseForm — category", () => {
  it("omits category entirely when no chip is touched", async () => {
    const fetchMock = stubCreateThenFetch();
    renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("category");
  });

  it("sends the selected category key on the create", async () => {
    const fetchMock = stubCreateThenFetch();
    renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByRole("button", { name: "Comida" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.category).toBe("comida");
  });
});
