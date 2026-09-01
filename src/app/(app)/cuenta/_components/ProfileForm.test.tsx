import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  refreshMock.mockClear();
});

function renderForm(displayName = "Alcie") {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return new Response(JSON.stringify({ user: { id: "u-1", displayName, avatar: null } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProfileForm displayName={displayName} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), calls };
}

const nameField = () => screen.getByLabelText("Nombre");
const saveButton = () => screen.getByRole("button", { name: "Guardar" });

describe("ProfileForm (T109)", () => {
  it("starts on the current name with nothing to save", () => {
    renderForm("Alcie");
    expect(nameField()).toHaveValue("Alcie");
    expect(saveButton()).toBeDisabled();
  });

  it("PATCHes only the display name — no user id is sent", async () => {
    const { user, calls } = renderForm();

    await user.clear(nameField());
    await user.type(nameField(), "Alicia");
    await user.click(saveButton());

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe("/api/auth/profile");
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.body).toEqual({ displayName: "Alicia" });
    expect(await screen.findByRole("status")).toHaveTextContent("Nombre actualizado.");
    // The header reads the name from a server render, not from this form.
    expect(refreshMock).toHaveBeenCalled();
  });

  it("won't submit an empty name", async () => {
    const { user, calls } = renderForm();

    await user.clear(nameField());

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(calls).toHaveLength(0);
  });

  it("surfaces a failed save without claiming success", async () => {
    const { user } = renderForm();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "nope" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await user.clear(nameField());
    await user.type(nameField(), "Alicia");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar el nombre. Intenta de nuevo.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
