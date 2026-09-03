/**
 * A chart's data as a real, navigable `<table>`, inside an `sr-only`
 * clipping wrapper. Keeping the table itself out of the intrinsic layout
 * prevents wide headers from creating a horizontal scrollbar (T114), while
 * preserving table navigation for screen readers. The first column is a row
 * header (the series label); the rest are values.
 */
export function HiddenDataTable({
  caption,
  columnLabels,
  rows,
}: {
  caption: string;
  /** `[rowHeaderLabel, ...valueColumnLabels]`. */
  columnLabels: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    <div className="sr-only overflow-hidden">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columnLabels.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={index}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
