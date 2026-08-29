import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberList } from "./MemberList";
import type { MemberSummary } from "./groupSettingsTypes";

afterEach(() => vi.unstubAllGlobals());

const members: MemberSummary[] = [
  { userId: "ana", displayName: "Ana", role: "owner", joinedAt: "2026-08-01T10:00:00Z" },
  { userId: "beto", displayName: "Beto", role: "member", joinedAt: "2026-08-05T10:00:00Z" },
];

function renderList(amOwner: boolean, myUserId = "ana") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemberList groupId="g1" members={members} myUserId={myUserId} amOwner={amOwner} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("MemberList", () => {
  it("shows roles and join dates, and no email addresses", () => {
    renderList(true);
    expect(screen.getByText(/Organizador ·/)).toBeInTheDocument();
    expect(screen.getByText(/Miembro ·/)).toBeInTheDocument();
    expect(screen.getAllByText(/se unió el/)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/@/);
  });

  it("omits the remove control entirely for a non-owner", () => {
    renderList(false, "beto");
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("renders the outstanding balances, per currency, when removal is refused for a non-zero balance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "MEMBER_HAS_BALANCE",
            message: "still owes",
            details: { balances: [{ currency: "COP", net: "-4730000" }, { currency: "USD", net: "1200" }] },
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = renderList(true);

    await user.click(screen.getByRole("button", { name: "Quitar" })); // open the dialog
    await user.click(screen.getAllByRole("button", { name: "Quitar" }).at(-1)!); // confirm

    expect(await screen.findByText(/No puedes salir debiendo/)).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("47.300"))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("12,00"))).toBeInTheDocument();
  });
});
