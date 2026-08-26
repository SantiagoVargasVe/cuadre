import { describe, expect, it } from "vitest";
import { formatCalendarDate } from "./format";

describe("formatCalendarDate", () => {
  it("formats a calendar date in Spanish", () => {
    expect(formatCalendarDate("2026-08-24")).toBe("24 de ago de 2026");
  });

  it("does not shift the day for a viewer far ahead of UTC", () => {
    // A naive `new Date(isoDate)` formatted in a non-UTC timezone can land
    // on the previous or next day. Anchoring at UTC midnight and
    // formatting in UTC must not depend on the host's local timezone.
    expect(formatCalendarDate("2026-01-01")).toBe("1 de ene de 2026");
    expect(formatCalendarDate("2026-12-31")).toBe("31 de dic de 2026");
  });
});
