import { ExactAmountsDoNotBalanceError, NonPositiveWeightError } from "../errors";

/**
 * The caller supplies the answer — no apportionment, no seed. Validated to
 * sum to the total and **rejected otherwise, never adjusted to fit**
 * (splitting.md §3, security.md § Money integrity).
 */
export function resolveExactSplit(amounts: Map<string, bigint>, total: bigint): Map<string, bigint> {
  for (const [id, amount] of amounts) {
    if (amount <= 0n) throw new NonPositiveWeightError(id, amount);
  }

  const sum = [...amounts.values()].reduce((acc, amount) => acc + amount, 0n);
  if (sum !== total) throw new ExactAmountsDoNotBalanceError(total, sum);

  return new Map(amounts);
}
