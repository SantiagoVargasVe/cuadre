import {
  EmptyApportionmentError,
  ExactAmountsDoNotBalanceError,
  NonPositiveWeightError,
  PercentagesDoNotSumError,
} from "../../../../../../lib/money/errors";
import { apportion } from "../../../../../../lib/money/apportion";
import { resolveEqualSplit } from "../../../../../../lib/money/strategies/equal";
import { resolveExactSplit } from "../../../../../../lib/money/strategies/exact";
import { resolveLoanSplit } from "../../../../../../lib/money/strategies/loan";
import { resolvePercentageSplit } from "../../../../../../lib/money/strategies/percentage";
import { resolveSharesSplit } from "../../../../../../lib/money/strategies/shares";
import type { SplitInput } from "../../../../../../lib/schemas/expenses";

/**
 * Every strategy funnels through this one function — the same
 * `src/lib/money/strategies/*` the server resolves with (T065's own
 * acceptance criteria: "the preview must be byte-identical to what gets
 * stored"). Throws the server's own typed errors
 * (`PercentagesDoNotSumError`, `ExactAmountsDoNotBalanceError`, ...) when
 * the current input can't be resolved yet — the shell catches these to
 * drive the live remainder, rather than re-deriving the same validation
 * by hand.
 */
export function resolveSplitPreview(
  split: SplitInput,
  allMemberIds: string[],
  total: bigint,
  seed: string,
): Map<string, bigint> {
  switch (split.strategy) {
    case "equal":
      return resolveEqualSplit(split.members ?? allMemberIds, total, seed);
    case "equal_subset":
      return resolveEqualSplit(split.members, total, seed);
    case "shares":
      return resolveSharesSplit(toBigIntMap(split.weights), total, seed);
    case "percentage":
      return resolvePercentageSplit(toBigIntMap(split.basisPoints), total, seed);
    case "exact":
      return resolveExactSplit(toAmountMap(split.amounts), total);
    case "loan":
      return resolveLoanSplit(split.to, total);
  }
}

function toBigIntMap(record: Record<string, number>): Map<string, bigint> {
  return new Map(Object.entries(record).map(([id, value]) => [id, BigInt(value)]));
}

function toAmountMap(record: Record<string, string>): Map<string, bigint> {
  return new Map(Object.entries(record).map(([id, amount]) => [id, BigInt(amount || "0")]));
}

/** Distributes `total` evenly among `ids` — the starting point offered
 * when switching into `shares`/`percentage`/`exact`, so the editor never
 * opens on an empty or zeroed-out state (splitting.md § 3.1's own rule,
 * reused here purely for a sensible default, not for storage). */
export function equalDefault(total: bigint, ids: string[], seed: string): Map<string, bigint> {
  const weights = new Map(ids.map((id) => [id, 1n]));
  return apportion(total, weights, seed);
}

export {
  EmptyApportionmentError,
  ExactAmountsDoNotBalanceError,
  NonPositiveWeightError,
  PercentagesDoNotSumError,
};
