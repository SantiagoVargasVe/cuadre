/**
 * RFC 4180 CSV serialization — comma-delimited, CRLF-terminated, quoted
 * only where the spec requires it.
 *
 * **The delimiter is a comma and decimals use `.`, deliberately** (T080).
 * An `es-CO` reader's Excel would be happier with `;` and `,`, but this
 * file is the app's escape hatch: it has to open in Sheets, in LibreOffice,
 * in pandas, in `csv.reader`, and in whatever a member's accountant uses.
 * Portability is the point of the export, so the portable dialect wins over
 * the locale-native one. Don't "fix" it to `;` — that's a product decision,
 * not an oversight.
 */

/**
 * The characters a spreadsheet treats as "this cell is a formula" after it
 * has ignored leading whitespace.
 */
const FORMULA_LEAD_CHARACTERS = new Set(["=", "+", "-", "@"]);

/**
 * Neutralises CSV injection. Expense titles and member display names are
 * user-controlled free text, and this file exists to be double-clicked into
 * Excel — a title of `=SUM(A1:A9)` (or the DDE payloads that start with
 * `+`/`-`/`@`) must arrive as text, not as something the spreadsheet
 * executes. A leading single quote is the escape both Excel and Sheets
 * honour: the cell reads back as the literal string, and the quote is not
 * part of the value once the sheet renders it.
 *
 * JSON party cells begin with `[` and intentionally remain untouched: names
 * inside them are data, not executable CSV cells, and changing them would
 * stop the field being parseable JSON. Other cells are neutralised here so
 * a future plain-text column cannot quietly reintroduce the hole.
 */
function neutraliseFormula(value: string): string {
  const firstNonWhitespace = value.match(/\S/)?.[0];
  return firstNonWhitespace && FORMULA_LEAD_CHARACTERS.has(firstNonWhitespace) ? `'${value}` : value;
}

/**
 * One cell, RFC 4180 §2.6–2.7: quote when the value contains the
 * delimiter, a quote, CR or LF, and double any embedded quote. Anything
 * else is emitted bare — quoting everything would parse identically but
 * makes the file harder to read in a terminal, which is half of why anyone
 * exports it.
 */
export function escapeCsvCell(value: string): string {
  const neutralised = neutraliseFormula(value);
  if (!/[",\r\n]/.test(neutralised)) return neutralised;
  return `"${neutralised.replaceAll('"', '""')}"`;
}

/** RFC 4180 §2.1: records are CRLF-terminated. */
const RECORD_SEPARATOR = "\r\n";

export function toCsvRow(cells: readonly string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * A header row plus zero or more data rows, with a trailing CRLF so the
 * file ends on a record boundary. A group with no expenses still gets its
 * header — an empty file and a group with nothing in it should not look
 * the same to whoever opens it.
 */
export function toCsvDocument(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map(toCsvRow).join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
}
