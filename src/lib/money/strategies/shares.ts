import { apportion } from "../apportion";

/**
 * "The couple counts as two." Weights are the shares directly — apportion()
 * already rejects a weight ≤ 0, which is the same rule as "shares must be
 * ≥ 1" for integers.
 */
export function resolveSharesSplit(
  weights: Map<string, bigint>,
  total: bigint,
  seed: string,
): Map<string, bigint> {
  return apportion(total, weights, seed);
}
