import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseAmountInput } from "../../lib/money/format";
import { MoneyField } from "./MoneyField";

describe("MoneyField", () => {
  it("groups a COP amount with thousands separators as the user types", async () => {
    const user = userEvent.setup();
    render(<MoneyField label="Monto" name="amount" currency="COP" />);

    await user.type(screen.getByLabelText("Monto"), "150000");

    expect(screen.getByLabelText("Monto")).toHaveValue("150.000");
  });

  it("survives a backspace without corrupting the grouping", async () => {
    const user = userEvent.setup();
    render(<MoneyField label="Monto" name="amount" currency="COP" />);
    const input = screen.getByLabelText("Monto");

    await user.type(input, "150000");
    await user.type(input, "{backspace}");

    expect(input).toHaveValue("15.000");
  });

  it("survives a paste of an already-formatted value", () => {
    render(<MoneyField label="Monto" name="amount" currency="COP" />);
    const input = screen.getByLabelText("Monto");

    fireEvent.change(input, { target: { value: "1.234.567" } });

    expect(input).toHaveValue("1.234.567");
  });

  it("keeps a trailing comma so a USD fraction can still be typed", async () => {
    const user = userEvent.setup();
    render(<MoneyField label="Monto" name="amount" currency="USD" />);
    const input = screen.getByLabelText("Monto");

    await user.type(input, "86,4");

    expect(input).toHaveValue("86,4");
  });

  it("submits a typed 150.000 as 15000000n minor units", async () => {
    const onSubmit = vi.fn();
    function Form() {
      const { register, handleSubmit } = useForm<{ amount: bigint }>({
        resolver: zodResolver(z.object({ amount: z.bigint() })),
      });
      return (
        <form
          onSubmit={handleSubmit(onSubmit)}
          data-testid="form"
        >
          <MoneyField
            label="Monto"
            currency="COP"
            {...register("amount", { setValueAs: (v: string) => parseAmountInput(v, "COP") })}
          />
        </form>
      );
    }
    const user = userEvent.setup();
    render(<Form />);

    await user.type(screen.getByLabelText("Monto"), "150000");
    fireEvent.submit(screen.getByTestId("form"));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toEqual({ amount: 15000000n });
  });
});
