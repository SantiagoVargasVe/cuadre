import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteLink } from "./InviteLink";

afterEach(() => vi.useRealTimers());

describe("InviteLink expiry", () => {
  it("marks an open link expired at its exact deadline and disables copying", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-10T12:00:00Z"));
    render(<InviteLink url="https://cuadre.example/join/shared" expiresAt="2030-01-11T12:00:00Z" />);
    expect(screen.getByRole("button", { name: "Copiar" })).toBeEnabled();
    await act(() => vi.advanceTimersByTimeAsync(86400000));
    expect(screen.getByRole("status")).toHaveTextContent("Este enlace expiró. Crea otro para seguir invitando.");
    expect(screen.getByRole("button", { name: "Copiar" })).toBeDisabled();
  });

  it("recognizes a link already expired when the settings are opened", () => {
    render(<InviteLink url="https://cuadre.example/join/shared" expiresAt="2000-01-01T12:00:00Z" />);
    expect(screen.getByRole("status")).toHaveTextContent("Este enlace expiró.");
    expect(screen.getByRole("button", { name: "Copiar" })).toBeDisabled();
  });
});
