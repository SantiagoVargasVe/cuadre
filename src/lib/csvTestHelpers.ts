/**
 * A strict RFC 4180 reader, for tests only.
 *
 * Written by hand rather than pulled in as a dependency (architecture.md —
 * adding one is an ADR), and deliberately *independent* of `src/lib/csv.ts`:
 * a round-trip test is only worth something if the reader doesn't share the
 * writer's assumptions. It accepts CRLF or LF records, quoted fields
 * containing `,`/`"`/CR/LF, and `""` as an escaped quote — and nothing else.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  const endRow = () => {
    row.push(field);
    field = "";
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index]!;

    if (quoted) {
      if (char !== '"') {
        field += char;
        index += 1;
      } else if (input[index + 1] === '"') {
        field += '"';
        index += 2;
      } else {
        quoted = false;
        index += 1;
      }
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
      index += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
    } else if (char === "\r" && input[index + 1] === "\n") {
      endRow();
      index += 2;
    } else if (char === "\n" || char === "\r") {
      endRow();
      index += 1;
    } else {
      field += char;
      index += 1;
    }
  }

  // A trailing record separator ends the file, it doesn't start an empty row.
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Header row + objects keyed by column name — how a spreadsheet or pandas
 * would see the file, which is the perspective the export's tests care about. */
export function parseCsvRecords(input: string): {
  header: string[];
  records: Record<string, string>[];
} {
  const [header = [], ...rows] = parseCsv(input);
  return {
    header,
    records: rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i] ?? ""]))),
  };
}
