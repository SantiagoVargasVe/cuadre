import { apportion } from "../apportion";

/**
 * Serves both `equal` and `equal_subset` (splitting.md §3) — they're the
 * same apportionment over different member lists. Which list to pass
 * (every current member, or a chosen subset) is a service-layer decision
 * that needs group membership from the database; this module only ever
 * sees the ids it's given.
 */
export function resolveEqualSplit(
  memberIds: string[],
  total: bigint,
  seed: string,
): Map<string, bigint> {
  const weights = new Map(memberIds.map((id) => [id, 1n]));
  return apportion(total, weights, seed);
}
