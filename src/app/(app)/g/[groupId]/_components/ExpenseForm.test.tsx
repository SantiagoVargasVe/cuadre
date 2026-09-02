import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { todayIso } from "./expenseFormSchema";
import {
  detailResponse,
  fillTitleAndAmount,
  jsonResponse,
  renderForm,
  stubCreateThenFetch,
} from "./expenseFormTestHelpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExpenseForm", () => {
  it("keeps save disabled until the form is valid", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("submits the documented minimal payload for the untouched default path", async () => {
    const fetchMock = stubCreateThenFetch();
    const { onCreated, invalidateSpy } = renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [postUrl, postInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(postUrl).toBe("/api/groups/g1/expenses");
    const body = JSON.parse(postInit.body as string);
    expect(body).toEqual({
      title: "Cena",
      date: todayIso(),
      amount: "10000000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    expect(body.paidBy).toBeUndefined();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(detailResponse));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["group", "g1"] });
  });

  it("renders the API's error message on a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, { error: { code: "PAYERS_DO_NOT_BALANCE", message: "Los pagadores no suman el total" } }),
      ),
    );
    renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Los pagadores no suman el total");
  });

  it("updates the save gate synchronously as an exact split becomes invalid and valid again", async () => {
    renderForm();
    const user = userEvent.setup();

    await fillTitleAndAmount(user);
    await user.click(screen.getByText("Dividido: entre todos"));
    await user.click(screen.getByRole("radio", { name: "Monto exacto" }));

    const anaAmount = screen.getByRole("textbox", { name: "Ana" });
    const betoAmount = screen.getByRole("textbox", { name: "Beto" });
    await user.clear(anaAmount);
    await user.type(anaAmount, "40000");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await user.clear(betoAmount);
    await user.type(betoAmount, "60000");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
  });
});
