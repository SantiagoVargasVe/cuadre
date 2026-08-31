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

describe("Avatar (T107 / T108)", () => {
  it("is deterministic — the same userId renders the same default avatar", () => {
    const a = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    const first = shape(a.container as HTMLElement);
    cleanup();
    const b = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    expect(first.length).toBeGreaterThan(100);
    expect(first).toBe(shape(b.container as HTMLElement));
  });

  it("two different userIds produce different default avatars", () => {
    const a = render(<Avatar userId="11111111-1111-4111-8111-111111111111" />);
    const first = shape(a.container as HTMLElement);
    cleanup();
    const b = render(<Avatar userId="22222222-2222-4222-8222-222222222222" />);
    expect(first).not.toBe(shape(b.container as HTMLElement));
  });

  it("renders the stored choice when one is given, and it beats the default", () => {
    const a = render(<Avatar userId="u1" />);
    const dflt = shape(a.container as HTMLElement);
    cleanup();
    const b = render(<Avatar userId="u1" avatar={{ variant: "pixel", seed: "abcdef", palette: "warm" }} />);
    const chosen = shape(b.container as HTMLElement);

    expect(chosen).not.toBe(dflt);
    // The same stored value renders identically for another viewer / session.
    cleanup();
    const c = render(<Avatar userId="whoever" avatar={{ variant: "pixel", seed: "abcdef", palette: "warm" }} />);
    expect(shape(c.container as HTMLElement)).toBe(chosen);
  });

  it("falls back to the default for a null or malformed stored choice", () => {
    const a = render(<Avatar userId="u1" />);
    const dflt = shape(a.container as HTMLElement);
    cleanup();
    expect(shape((render(<Avatar userId="u1" avatar={null} />).container as HTMLElement))).toBe(dflt);
    cleanup();
    // seed too short, unknown palette → guarded back to the default.
    expect(
      shape((render(<Avatar userId="u1" avatar={{ variant: "beam", seed: "x", palette: "nope" as never }} />).container as HTMLElement)),
    ).toBe(dflt);
  });

  it("is decorative — no img role reaches the accessibility tree", () => {
    render(
      <div>
        <Avatar userId="u1" />
        <span>Ana</span>
      </div>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("takes a plain size number", () => {
    const { container } = render(<Avatar userId="u1" size={20} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle({ width: "20px", height: "20px" });
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
  });
});
