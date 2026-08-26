import { apportionPositive } from "../apportion";
import { PercentagesDoNotSumError } from "../errors";

const TOTAL_BASIS_POINTS = 10000n;

/**
 * Basis points, integers, summing to exactly 10000 — never a float
 * percentage; `60%` is `6000` (splitting.md §3). The basis points *are*
 * the apportionment weights: 10000 plays the role of the weight total, so
 * the same largest-remainder rule applies unchanged. A tiny money total
 * split across many members can still zero out one member's resolved
 * *amount* even with a healthy basis-point weight, so this drops zero
 * shares the same way equal/shares do.
 */
export function resolvePercentageSplit(
  basisPoints: Map<string, bigint>,
  total: bigint,
  seed: string,
): Map<string, bigint> {
  const sum = [...basisPoints.values()].reduce((acc, bp) => acc + bp, 0n);
  if (sum !== TOTAL_BASIS_POINTS) throw new PercentagesDoNotSumError(sum);

  return apportionPositive(total, basisPoints, seed);
}
