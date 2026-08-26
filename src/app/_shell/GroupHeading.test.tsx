import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GroupHeading } from "./GroupHeading";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  replaceMock.mockClear();
});

describe("GroupHeading", () => {
  it("renders the group's title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { group: { id: "abc", title: "Cartagena 2026" } })),
    );

    renderWithClient(<GroupHeading groupId="abc" />);

    expect(await screen.findByRole("heading", { name: "Cartagena 2026" })).toBeInTheDocument();
  });

  it("bounces to /groups when the group isn't found (not a member)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found" } }),
        ),
    );

    renderWithClient(<GroupHeading groupId="abc" />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/groups"));
  });
});
