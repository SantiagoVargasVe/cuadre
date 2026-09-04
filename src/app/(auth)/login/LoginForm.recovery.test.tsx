import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

afterEach(() => {
  searchParams = new URLSearchParams();
});

describe("LoginForm — password recovery entry points", () => {
  it("links to /forgot-password, without which the whole flow is unreachable", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.queryByText(/Tu contraseña se actualizó/)).not.toBeInTheDocument();
  });

  it("confirms a completed reset when it arrives at ?reset=1", () => {
    searchParams = new URLSearchParams({ reset: "1" });
    render(<LoginForm />);

    expect(
      screen.getByText("Tu contraseña se actualizó. Inicia sesión con la nueva."),
    ).toBeInTheDocument();
  });
});
