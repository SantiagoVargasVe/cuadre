/**
 * Streamed into the tab panel while a tab's `page` awaits its data (T106).
 * The layout's heading and tab bar stay painted above it, so a tab switch
 * responds immediately and this shows in the panel below — a skeleton
 * shaped like the feed/list content, not a spinner in an empty page.
 */
export default function GroupTabLoading() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
      ))}
    </div>
  );
}
