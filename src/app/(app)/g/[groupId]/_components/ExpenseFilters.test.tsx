import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseFilters } from "./ExpenseFilters";
import type { ExpenseFilters as ExpenseFiltersValue } from "../../../../../lib/schemas/expenseFilters";
import type { GroupMember } from "./types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const ANA = "11111111-1111-4111-8111-111111111111";
const members: GroupMember[] = [
  { userId: ANA, displayName: "Ana", role: "owner" },
  { userId: "22222222-2222-4222-8222-222222222222", displayName: "Beto", role: "member" },
];

beforeEach(() => pushMock.mockClear());

function renderFilters(filters: ExpenseFiltersValue = {}) {
  render(<ExpenseFilters groupId="g1" filters={filters} members={members} />);
  return userEvent.setup();
}

const openPanel = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /^Filtros/ }));

describe("ExpenseFilters (T115)", () => {
  it("puts the search term in the URL and omits every empty control", async () => {
    const user = renderFilters();

    await user.type(screen.getByLabelText("Buscar gastos"), "hotel");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(pushMock).toHaveBeenCalledWith("/g/g1?q=hotel");
  });

  it("serialises a category chosen from the collapsed panel", async () => {
    const user = renderFilters();

    await openPanel(user);
    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(await screen.findByRole("option", { name: "Alojamiento" }));
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(pushMock).toHaveBeenCalledWith("/g/g1?category=alojamiento");
  });

  it("shows a member by name, never by id", async () => {
    const user = renderFilters({ member: ANA });

    expect(screen.getByRole("combobox", { name: "Persona" })).toHaveTextContent("Ana");
    await openPanel(user);
    expect(screen.queryByText(ANA)).not.toBeInTheDocument();
  });

  it("combines filters into one query string", async () => {
    const user = renderFilters();

    await user.type(screen.getByLabelText("Buscar gastos"), "cena");
    await openPanel(user);
    await user.click(screen.getByRole("combobox", { name: "Moneda" }));
    await user.click(await screen.findByRole("option", { name: "USD" }));
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(pushMock).toHaveBeenCalledWith("/g/g1?q=cena&currency=USD");
  });

  it("counts the active filters the URL arrived with and opens the panel for them", () => {
    renderFilters({ q: "hotel", currency: "COP", from: "2026-08-01" });

    expect(screen.getByRole("button", { name: "Filtros (3 activos)" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent("COP");
  });

  it("leaves the panel closed and uncounted when nothing is filtered", () => {
    renderFilters();

    const disclosure = screen.getByRole("button", { name: "Filtros" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox", { name: "Moneda" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("clears every filter back to the bare group URL", async () => {
    const user = renderFilters({ q: "hotel", category: "comida" });

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(pushMock).toHaveBeenCalledWith("/g/g1");
  });
});
