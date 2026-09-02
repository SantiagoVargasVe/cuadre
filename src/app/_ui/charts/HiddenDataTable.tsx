/**
 * A chart's data as a real, navigable `<table>` — `sr-only`, so it is
 * visually hidden but fully available to a screen reader (T081). Every
 * chart in the app pairs its SVG with one of these. The first column is a
 * row header (the series label); the rest are values.
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
    <table className="sr-only">
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
  );
}
