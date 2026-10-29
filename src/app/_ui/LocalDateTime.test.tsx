import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatDateTime } from "../../lib/date/format";
import { LocalDateTime } from "./LocalDateTime";

const deadline = "2030-01-11T12:00:00.000Z";

describe("LocalDateTime", () => {
  it("labels the server's deadline as UTC before the viewer's timezone is available", () => {
    expect(renderToString(<LocalDateTime value={deadline} />)).toContain("2030-01-11 12:00 UTC");
  });

  it("shows local time on the client while retaining the exact machine-readable instant", () => {
    const { container } = render(<LocalDateTime value={deadline} />);
    const time = container.querySelector("time");
    expect(time?.textContent).toBe(formatDateTime(deadline));
    expect(time).toHaveAttribute("datetime", deadline);
  });
});
