import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GroupTabs } from "./GroupTabs";

const pushMock = vi.fn();
let pathname = "/g/abc";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
  pathname = "/g/abc";
});

describe("GroupTabs", () => {
  it("marks Gastos active at the group's base path", () => {
    render(<GroupTabs groupId="abc" />);
    expect(screen.getByRole("tab", { name: "Gastos" })).toHaveAttribute("aria-selected", "true");
  });

  it("marks Balances active on the /balances path", () => {
    pathname = "/g/abc/balances";
    render(<GroupTabs groupId="abc" />);
    expect(screen.getByRole("tab", { name: "Balances" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("marks Ajustes active on the /ajustes path", () => {
    pathname = "/g/abc/ajustes";
    render(<GroupTabs groupId="abc" />);
    expect(screen.getByRole("tab", { name: "Ajustes" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the balances route when that tab is clicked", async () => {
    const user = userEvent.setup();
    render(<GroupTabs groupId="abc" />);

    await user.click(screen.getByRole("tab", { name: "Balances" }));

    expect(pushMock).toHaveBeenCalledWith("/g/abc/balances");
  });
});
