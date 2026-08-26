import { EmptyApportionmentError, NonPositiveWeightError } from "./errors";
import { assertPositive } from "./parse";

/**
 * A deterministic, dependency-free 32-bit hash (FNV-1a) of an arbitrary
 * seed string — "uint32(seed)" in splitting.md §3.1. Any well-distributed
 * hash works here; what matters is that the same string always produces
 * the same number, so the rotation offset below is reproducible.
 */
function hashSeedToUint32(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The most important function in this codebase (splitting.md §3.1). Splits
 * `total` among `weights` by the largest remainder method: floor each
 * share, then hand the leftover units to the largest fractional
 * remainders, comparing remainders as exact integers.
 *
 * Ties — including the *all-tied* case of an `equal` split — are broken by
 * rotation, not by member id: `offset = uint32(seed) % n` picks a starting
 * point in member-id order, and members are ranked by distance from that
 * offset (wrapping) rather than by id directly. Reusing `seed` (the
 * expense id, in practice) means the same expense always apportions
 * identically, but a *different* expense rotates who absorbs the leftover
 * unit — dropping either the sort-by-id-within-a-tier or the rotation
 * would silently break one of those two properties without a
 * single-expense test noticing.
 */
export function apportion<Id extends string>(
  total: bigint,
  weights: Map<Id, bigint>,
  seed: string,
): Map<Id, bigint> {
  assertPositive(total);
  const ids = [...weights.keys()];
  if (ids.length === 0) throw new EmptyApportionmentError();
  for (const id of ids) {
    const weight = weights.get(id)!;
    if (weight <= 0n) throw new NonPositiveWeightError(id, weight);
  }

  const totalWeight = ids.reduce((sum, id) => sum + weights.get(id)!, 0n);
  const n = ids.length;
  const sortedIds = [...ids].sort();
  const offset = hashSeedToUint32(seed) % n;
  const rotatedRank = new Map(sortedIds.map((id, i) => [id, (i - offset + n) % n]));

  const base = new Map<Id, bigint>();
  const remainder = new Map<Id, bigint>();
  let baseSum = 0n;
  for (const id of ids) {
    const weight = weights.get(id)!;
    const share = total * weight;
    const b = share / totalWeight;
    base.set(id, b);
    remainder.set(id, share % totalWeight);
    baseSum += b;
  }

  // Exact by construction — see the derivation in apportion.test.ts —
  // never a division, and always 0 ≤ extraUnits < n.
  const extraUnits = Number(total - baseSum);

  const order = [...ids].sort((a, b) => {
    const remainderDiff = remainder.get(b)! - remainder.get(a)!;
    if (remainderDiff !== 0n) return remainderDiff > 0n ? 1 : -1;
    return rotatedRank.get(a)! - rotatedRank.get(b)!;
  });

  const result = new Map<Id, bigint>();
  order.forEach((id, index) => {
    result.set(id, base.get(id)! + (index < extraUnits ? 1n : 0n));
  });
  return result;
}

/**
 * Same as `apportion()`, but drops any member whose resolved share comes
 * out to zero. A total smaller than the member count legitimately
 * produces a zero share for some of them under the largest-remainder
 * method (see apportion.test.ts's "total smaller than the member count"
 * case) — correct as a general apportionment result, but a persisted
 * `expense_splits`/`expense_payers` row is `CHECK (amount > 0)`: a member
 * with a zero share should not be in the split at all, the same principle
 * `apportion()` already applies to a zero-weight *input* (splitting.md
 * §3). Callers that resolve amounts meant to be written to those tables
 * (equal/shares/percentage) use this; a caller doing a purely internal
 * sub-allocation that never gets persisted as its own row (pairwise
 * attribution, T041) uses plain `apportion()` instead, since a zero there
 * is harmless.
 */
export function apportionPositive<Id extends string>(
  total: bigint,
  weights: Map<Id, bigint>,
  seed: string,
): Map<Id, bigint> {
  const result = apportion(total, weights, seed);
  for (const [id, amount] of result) {
    if (amount === 0n) result.delete(id);
  }
  return result;
}
