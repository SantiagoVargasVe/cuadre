export interface Bar {
  /** Left-hand label — a member name, a category, or a date bucket. */
  label: string;
  /** Non-negative total this bar represents, in minor units. */
  value: number;
  /** The same amount already formatted upstream through `<Money>` / format.ts. */
  valueText: string;
}

const ROW_HEIGHT = 34;

/**
 * A horizontal bar list, hand-rolled SVG (T081) — the shared primitive
 * behind every insights chart, and reused by T082/T084. **Colour is never
 * the only encoding**: each bar carries its label and its value as text,
 * so the single fill is decorative. Driven entirely by design tokens via
 * `currentColor` + a `text-*` class (the pattern the app's other inline
 * SVGs already use), correct in light and dark.
 *
 * No `viewBox`: width is `100%`, height is fixed per row, so text renders
 * at real pixel sizes and never distorts or overlaps when the container
 * narrows to 375px.
 */
export function BarSeries({
  title,
  description,
  bars,
}: {
  title: string;
  description: string;
  bars: Bar[];
}) {
  const max = bars.reduce((running, bar) => Math.max(running, bar.value), 0);
  const height = Math.max(bars.length, 1) * ROW_HEIGHT;

  return (
    <svg role="img" width="100%" height={height} className="block">
      <title>{title}</title>
      <desc>{description}</desc>
      {bars.map((bar, index) => {
        const top = index * ROW_HEIGHT;
        const fillPercent = max > 0 ? (bar.value / max) * 100 : 0;
        return (
          <g key={bar.label}>
            <text x={0} y={top + 12} fontSize={11} className="text-foreground" fill="currentColor">
              {bar.label}
            </text>
            <text
              x="100%"
              y={top + 12}
              fontSize={11}
              textAnchor="end"
              className="text-foreground [font-variant-numeric:tabular-nums]"
              fill="currentColor"
            >
              {bar.valueText}
            </text>
            <rect x={0} y={top + 18} width="100%" height={8} rx={4} className="text-muted" fill="currentColor" />
            <rect
              x={0}
              y={top + 18}
              width={`${fillPercent}%`}
              height={8}
              rx={4}
              className="text-chart-1"
              fill="currentColor"
            />
          </g>
        );
      })}
    </svg>
  );
}
