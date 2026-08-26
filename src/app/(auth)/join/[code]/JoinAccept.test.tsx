import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinAccept } from "./JoinAccept";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
});

describe("JoinAccept", () => {
  it("posts to accept and redirects to /groups on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { group: { id: "g1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<JoinAccept code="ABC123" />);
    await user.click(screen.getByRole("button", { name: "Unirme al grupo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/invites/ABC123/accept", expect.anything()));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
  });

  it("treats ALREADY_A_MEMBER as success, not an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: "ALREADY_A_MEMBER", message: "..." } }),
      ),
    );
    const user = userEvent.setup();

    render(<JoinAccept code="ABC123" />);
    await user.click(screen.getByRole("button", { name: "Unirme al grupo" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/groups"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a generic error for anything else and stays on the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: "INVALID_INVITE_CODE", message: "..." } }),
      ),
    );
    const user = userEvent.setup();

    render(<JoinAccept code="ABC123" />);
    await user.click(screen.getByRole("button", { name: "Unirme al grupo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ocurrió un error. Intenta de nuevo.");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
