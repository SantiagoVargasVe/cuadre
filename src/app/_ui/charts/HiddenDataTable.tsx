/**
 * A chart's data as a real, navigable `<table>` — `sr-only`, so it is
 * visually hidden but fully available to a screen reader (T081). Every
 * chart in the app pairs its SVG with one of these.
 */
export function HiddenDataTable({
  caption,
  columnLabels,
  rows,
}: {
  caption: string;
  columnLabels: [string, string];
  rows: { label: string; value: string }[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{columnLabels[0]}</th>
          <th scope="col">{columnLabels[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
