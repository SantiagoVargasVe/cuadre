import { apportionPositive } from "../apportion";

/**
 * "The couple counts as two." Weights are the shares directly — apportion()
 * already rejects a weight ≤ 0, which is the same rule as "shares must be
 * ≥ 1" for integers. `apportionPositive` additionally drops a member whose
 * resolved *share* comes out to zero (a tiny total split among many
 * members can do that) — a member with a zero share should not be in the
 * split at all.
 */
export function resolveSharesSplit(
  weights: Map<string, bigint>,
  total: bigint,
  seed: string,
): Map<string, bigint> {
  return apportionPositive(total, weights, seed);
}
