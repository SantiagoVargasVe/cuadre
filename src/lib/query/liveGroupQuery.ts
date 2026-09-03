/**
 * The staleness policy for a group's live reads (T117). Spread it into any
 * query that shows something another member can change:
 *
 *     useQuery({ queryKey, queryFn, initialData, ...liveGroupRead })
 *
 * Two knobs, named once here so no component invents its own.
 *
 * **`staleTime` has to be finite.** `staleTime: Infinity` doesn't only
 * disable polling — it disables TanStack's default refetch-on-focus, and it
 * silently discards the server's freshly rendered `initialData` whenever the
 * cache already holds an entry for that key. That's the bug this replaces:
 * the `QueryClient` lives in the root `Providers`, so its cache outlives tab
 * navigation, and returning to Balances re-computed the balances on the
 * server and then rendered the *previous* visit's numbers. It self-corrected
 * only once the entry had been garbage-collected (`gcTime`, 5 minutes with
 * no observer), which is why it read as intermittent.
 *
 * Kept shorter than the interval so the cheap refresh wins: coming back to a
 * backgrounded app refetches immediately instead of waiting for a tick.
 *
 * **`refetchInterval` is the poll** for the case focus can't cover — the
 * phone lying face-up on the table while somebody else adds an expense.
 * `refetchIntervalInBackground` is left at its default `false`, so a hidden
 * tab stops polling and catches up when it comes back.
 *
 * Cost: one request per mounted tab per interval. The group tabs are
 * separate routes, so a device polls one or two endpoints, never all of
 * them — ten foregrounded members is 0.08 req/s. The arithmetic is in
 * `backlog/tasks/T117-live-refresh-group-reads.md`.
 *
 * **Not for FX.** `fx-quote` keeps its own 5-minute `staleTime` and no
 * interval, and a group's pinned rate is never refreshed on a timer
 * (CLAUDE.md non-negotiable 5) — a poll that moved a pinned total would
 * break a product promise, not just a cache.
 */
export const LIVE_STALE_TIME_MS = 30_000;

/** 2 minutes: fast enough that a table full of people stays in sync,
 * slow enough to be invisible on a phone's radio. */
export const LIVE_REFRESH_INTERVAL_MS = 120_000;

export const liveGroupRead = {
  staleTime: LIVE_STALE_TIME_MS,
  refetchInterval: LIVE_REFRESH_INTERVAL_MS,
} as const;

/**
 * Past this many loaded pages, the feed stops polling. A refetch of an
 * infinite query re-reads *every* retained page, so this is the one place
 * where polling could multiply into N requests per tick.
 */
export const LIVE_MAX_POLLED_PAGES = 4;

/**
 * The feed's `refetchInterval`, as a function of how many pages are loaded.
 *
 * `maxPages` is the obvious-looking answer and is the wrong one here: it
 * evicts the *first* pages, which in a `(date, id)` descending feed are the
 * newest expenses — the top of the list would silently disappear as someone
 * paged into the past. It's only usable with bidirectional pagination, and
 * "load more" is forward-only.
 *
 * So cap the timer instead. A member who has paged 200 expenses back is
 * reading history, not watching for a new one, and they still get a refresh
 * on focus and after any write.
 */
export function livePollInterval(loadedPages: number): number | false {
  return loadedPages <= LIVE_MAX_POLLED_PAGES ? LIVE_REFRESH_INTERVAL_MS : false;
}
