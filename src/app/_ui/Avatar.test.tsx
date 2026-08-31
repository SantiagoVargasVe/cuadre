import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

afterEach(cleanup);

/** `boring-avatars` uses `useId` for an internal SVG mask id — position-
 * dependent, invisible. Normalise it so we compare only what a viewer sees. */
const shape = (root: HTMLElement) =>
  (root.querySelector("svg")?.outerHTML ?? "")
    .replace(/id="[^"]*"/g, 'id=""')
    .replace(/url\(#[^)]*\)/g, "url(#)");

describe("Avatar (T107)", () => {
  it("is deterministic — the same userId renders the same avatar", () => {
    const first = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    const a = shape(first.container as HTMLElement);
    cleanup();
    const second = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    const b = shape(second.container as HTMLElement);

    expect(a.length).toBeGreaterThan(100);
    expect(a).toBe(b);
  });

  it("two different userIds produce different avatars", () => {
    const first = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    const a = shape(first.container as HTMLElement);
    cleanup();
    const second = render(<Avatar userId="22222222-2222-4222-8222-222222222222" />);
    const b = shape(second.container as HTMLElement);

    expect(a).not.toBe(b);
  });

  it("is not seeded by displayName — a rename does not change the avatar", () => {
    const first = render(<Avatar userId="u1" displayName="Ana" />);
    const a = shape(first.container as HTMLElement);
    cleanup();
    const second = render(<Avatar userId="u1" displayName="Ana María Restrepo" />);
    const b = shape(second.container as HTMLElement);

    expect(a).toBe(b);
  });

  it("is decorative — nothing about it reaches the accessibility tree as identity", () => {
    render(
      <div>
        <Avatar userId="u1" displayName="Ana" />
        <span>Ana</span>
      </div>,
    );
    // The wrapper is aria-hidden; the boring-avatars <svg role="img"> under it
    // must not surface as an image, and there is no "Ana" avatar image name.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("takes a plain size number, not a wall of layout props", () => {
    const { container } = render(<Avatar userId="u1" size={20} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "20px", height: "20px" });
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
  });
});
