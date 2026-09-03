export interface PairedRow {
  label: string;
  a: { value: number; valueText: string };
  b: { value: number; valueText: string };
  balance: { text: string; className: string };
}

const ROW_HEIGHT = 114;

/**
 * Two bars per row on one shared scale — paid vs. consumed per member
 * (T082). Same hand-rolled, token-driven SVG as `BarSeries`: `currentColor`
 * + a `text-*` class, no `viewBox` so text never distorts at 375px. Each
 * bar is labelled with its own value as text, so the two colours are
 * decorative and never the only distinction (design-system.md). `role="img"`
 * with `<title>`/`<desc>`; the caller pairs it with a `HiddenDataTable`.
 */
export function PairedBars({
  title,
  description,
  aLabel,
  bLabel,
  rows,
}: {
  title: string;
  description: string;
  aLabel: string;
  bLabel: string;
  rows: PairedRow[];
}) {
  const max = rows.reduce((running, row) => Math.max(running, row.a.value, row.b.value), 0);
  const height = Math.max(rows.length, 1) * ROW_HEIGHT;
  const pct = (value: number) => (max > 0 ? (value / max) * 100 : 0);

  return (
    <svg role="img" width="100%" height={height} className="block">
      <title>{title}</title>
      <desc>{description}</desc>
      {rows.map((row, index) => {
        const top = index * ROW_HEIGHT;
        return (
          <g key={row.label}>
            <text x={0} y={top + 14} fontSize={12} className="text-foreground" fill="currentColor">
              {row.label}
            </text>
            <text
              x="100%"
              y={top + 34}
              fontSize={12}
              textAnchor="end"
              className={`${row.balance.className} tabular-nums`}
              fill="currentColor"
            >
              {row.balance.text}
            </text>
            <text x="100%" y={top + 54} fontSize={12} textAnchor="end" className="text-foreground [font-variant-numeric:tabular-nums]" fill="currentColor">
              {aLabel} {row.a.valueText}
            </text>
            <rect x={0} y={top + 66} width="100%" height={8} rx={4} className="text-muted" fill="currentColor" />
            <rect x={0} y={top + 66} width={`${pct(row.a.value)}%`} height={8} rx={4} className="text-chart-1" fill="currentColor" />
            <text x="100%" y={top + 88} fontSize={12} textAnchor="end" className="text-foreground [font-variant-numeric:tabular-nums]" fill="currentColor">
              {bLabel} {row.b.valueText}
            </text>
            <rect x={0} y={top + 100} width="100%" height={8} rx={4} className="text-muted" fill="currentColor" />
            <rect x={0} y={top + 100} width={`${pct(row.b.value)}%`} height={8} rx={4} className="text-chart-2" fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
}
