import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fillTitleAndAmount, renderForm, stubCreateThenFetch } from "./expenseFormTestHelpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExpenseForm — multiple payers", () => {
  it("shows a live remainder for multiple payers and includes paidBy on submit", async () => {
    const fetchMock = stubCreateThenFetch();
    renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByText("Pagado por: tú"));
    await user.click(screen.getByRole("checkbox", { name: "Beto" }));

    expect(await screen.findByText(/Faltan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Ana" }), "60000");
    await user.type(screen.getByRole("textbox", { name: "Beto" }), "40000");

    expect(await screen.findByText("Balanceado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, postInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(postInit.body as string);
    expect(body.paidBy).toEqual(
      expect.arrayContaining([
        { userId: "ana", amount: "6000000" },
        { userId: "beto", amount: "4000000" },
      ]),
    );
  });
});
