import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsvDocument, toCsvRow } from "./csv";
import { parseCsv } from "./csvTestHelpers";

describe("escapeCsvCell", () => {
  it("leaves an ordinary value bare", () => {
    expect(escapeCsvCell("Cena en Cartagena")).toBe("Cena en Cartagena");
    expect(escapeCsvCell("300000.00")).toBe("300000.00");
    expect(escapeCsvCell("")).toBe("");
  });

  it("quotes and doubles per RFC 4180", () => {
    expect(escapeCsvCell("Cena, taxi")).toBe('"Cena, taxi"');
    expect(escapeCsvCell('El "mejor" ceviche')).toBe('"El ""mejor"" ceviche"');
    expect(escapeCsvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it.each(["=", "+", "-", "@"]) (
    "neutralises a cell leading with %j so a spreadsheet reads it as text",
    (lead) => {
      expect(escapeCsvCell(`${lead}SUM(A1:A9)`).replace(/^"|"$/g, "")).toMatch(/^'/);
    },
  );

  it("checks the first non-whitespace character", () => {
    expect(escapeCsvCell("  =SUM(A1:A9)")).toBe("'  =SUM(A1:A9)");
  });

  it("only neutralises the leading character, not one in the middle", () => {
    expect(escapeCsvCell("Almuerzo 2+2")).toBe("Almuerzo 2+2");
  });

  it("still quotes an injection-escaped value that also needs quoting", () => {
    // The `'` goes on first, then the whole thing is quoted — otherwise a
    // parser would strip the quotes and hand a live formula back.
    expect(escapeCsvCell('=HYPERLINK("a","b")')).toBe('"\'=HYPERLINK(""a"",""b"")"');
  });
});

describe("toCsvRow / toCsvDocument", () => {
  it("joins cells with commas and records with CRLF, terminating the file", () => {
    expect(toCsvRow(["a", "b"])).toBe("a,b");
    expect(toCsvDocument(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });

  it("emits the header even with no rows", () => {
    const csv = toCsvDocument(["a", "b"], []);
    expect(csv).toBe("a,b\r\n");
    expect(parseCsv(csv)).toEqual([["a", "b"]]);
  });

  it("round-trips a hostile title through an independent parser", () => {
    const title = 'Cena, "la mejor"\nde Cartagena';
    const [, row] = parseCsv(toCsvDocument(["title"], [[title]]));
    expect(row).toEqual([title]);
  });
});
