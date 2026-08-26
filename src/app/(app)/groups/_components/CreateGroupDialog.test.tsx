import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateGroupDialog } from "./CreateGroupDialog";

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

describe("CreateGroupDialog", () => {
  it("creates a group and navigates to it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { group: { id: "new-group-id", title: "Cartagena" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CreateGroupDialog />);
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));
    await user.type(await screen.findByLabelText("Título"), "Cartagena");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/groups");
    expect(JSON.parse(init.body as string)).toMatchObject({ title: "Cartagena" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/g/new-group-id"));
  });

  it("keeps submit disabled until a title is entered", async () => {
    const user = userEvent.setup();
    render(<CreateGroupDialog />);
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));

    expect(await screen.findByRole("button", { name: "Crear" })).toBeDisabled();
  });

  it("renders the API's error message when creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Título inválido" } }),
        ),
    );
    const user = userEvent.setup();

    render(<CreateGroupDialog />);
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));
    await user.type(await screen.findByLabelText("Título"), "x");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Título inválido");
  });
});
