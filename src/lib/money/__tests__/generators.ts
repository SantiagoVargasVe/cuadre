import fc, { type GeneratorValue } from "fast-check";
import { apportion } from "../apportion";
import { resolveEqualSplit } from "../strategies/equal";
import { resolveExactSplit } from "../strategies/exact";
import { resolveLoanSplit } from "../strategies/loan";
import { resolvePercentageSplit } from "../strategies/percentage";
import { resolveSharesSplit } from "../strategies/shares";

/**
 * A random-ledger generator for the property harness (testing.md §
 * Property-based tests, splitting.md §8). Every expense's payers and
 * splits are produced by calling the real T031 strategy resolvers — this
 * generates *valid* random ledgers by construction, so a property failure
 * always points at a real invariant violation, never at a malformed
 * fixture.
 */

export const CURRENCIES = ["COP", "USD", "EUR"] as const;
export type GeneratedCurrency = (typeof CURRENCIES)[number];

export const STRATEGIES = ["equal", "equal_subset", "shares", "percentage", "exact", "loan"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export interface GeneratedExpense {
  id: string;
  currency: GeneratedCurrency;
  total: bigint;
  strategy: Strategy;
  payers: Map<string, bigint>;
  splits: Map<string, bigint>;
}

export interface GeneratedSettlement {
  id: string;
  from: string;
  to: string;
  amount: bigint;
  currency: GeneratedCurrency;
}

export interface GeneratedLedger {
  memberIds: string[];
  expenses: GeneratedExpense[];
  settlements: GeneratedSettlement[];
}

/**
 * Spans 1n to well past Number.MAX_SAFE_INTEGER on purpose: small totals
 * are where apportionment has fewer units than members to hand out, and
 * huge ones are where a stray `Number` coercion would silently truncate.
 */
function genTotal(g: GeneratorValue): bigint {
  const magnitude = g(fc.constantFrom, "tiny", "normal", "huge");
  if (magnitude === "tiny") return g(fc.bigInt, { min: 1n, max: 20n });
  if (magnitude === "huge") {
    return g(fc.bigInt, {
      min: BigInt(Number.MAX_SAFE_INTEGER),
      max: BigInt(Number.MAX_SAFE_INTEGER) * 1_000_000n,
    });
  }
  return g(fc.bigInt, { min: 21n, max: BigInt(Number.MAX_SAFE_INTEGER) });
}

function genSubset(g: GeneratorValue, memberIds: readonly string[]): string[] {
  return g(fc.shuffledSubarray<string>, [...memberIds], {
    minLength: 1,
    maxLength: memberIds.length,
  });
}

function genPositiveWeights(g: GeneratorValue, ids: readonly string[]): Map<string, bigint> {
  const weights = new Map<string, bigint>();
  for (const id of ids) weights.set(id, g(fc.bigInt, { min: 1n, max: 1000n }));
  return weights;
}

/**
 * `ids.length` random positive integers summing to exactly `target` —
 * every one strictly ≥ 1, unlike a raw `apportion()` call, which can
 * legitimately zero out a member when weights are skewed relative to a
 * small target (a valid apportion() behavior, confirmed by T031's own
 * "total smaller than the member count" test, but *not* a valid `exact`
 * amount or `percentage` basis-point weight — both must be positive by
 * definition). Gives each id a baseline of 1, then apportions whatever
 * remains — 0 or more — on top.
 */
function genPositiveAmountsSummingTo(
  g: GeneratorValue,
  ids: readonly string[],
  target: bigint,
  seed: string,
): Map<string, bigint> {
  const remainder = target - BigInt(ids.length);
  const amounts = new Map(ids.map((id) => [id, 1n]));
  if (remainder === 0n) return amounts;

  const extra = apportion(remainder, genPositiveWeights(g, ids), seed);
  for (const id of ids) amounts.set(id, amounts.get(id)! + extra.get(id)!);
  return amounts;
}

/** Caps a subset's size so `genPositiveAmountsSummingTo` can always give everyone ≥ 1 of `target`. */
function genSubsetBoundedBy(g: GeneratorValue, memberIds: readonly string[], target: bigint): string[] {
  const cap = target < BigInt(memberIds.length) ? Number(target) : memberIds.length;
  return g(fc.shuffledSubarray<string>, [...memberIds], { minLength: 1, maxLength: cap });
}

function genSplits(
  g: GeneratorValue,
  strategy: Strategy,
  memberIds: readonly string[],
  total: bigint,
  seed: string,
): Map<string, bigint> {
  switch (strategy) {
    case "equal":
      return resolveEqualSplit([...memberIds], total, seed);
    case "equal_subset":
      return resolveEqualSplit(genSubset(g, memberIds), total, seed);
    case "shares":
      return resolveSharesSplit(genPositiveWeights(g, genSubset(g, memberIds)), total, seed);
    case "percentage": {
      // 10000 comfortably exceeds the 15-member cap, so the subset never
      // needs bounding the way `exact`'s does against a possibly-tiny total.
      const subset = genSubset(g, memberIds);
      const basisPoints = genPositiveAmountsSummingTo(g, subset, 10000n, `${seed}-bp`);
      return resolvePercentageSplit(basisPoints, total, seed);
    }
    case "exact": {
      const subset = genSubsetBoundedBy(g, memberIds, total);
      const amounts = genPositiveAmountsSummingTo(g, subset, total, `${seed}-exact`);
      return resolveExactSplit(amounts, total);
    }
    case "loan":
      return resolveLoanSplit(g(fc.constantFrom, ...memberIds), total);
  }
}

function genExpense(g: GeneratorValue, memberIds: readonly string[]): GeneratedExpense {
  const id = g(fc.uuid);
  const currency = g(fc.constantFrom, ...CURRENCIES);
  const total = genTotal(g);
  const strategy = g(fc.constantFrom, ...STRATEGIES);

  const splits = genSplits(g, strategy, memberIds, total, id);
  // Random payer counts 1..n: any non-empty subset of the group. Every
  // payer amount must be positive — a real expense_payers row is
  // CHECK(amount > 0) — so this uses the same "everyone gets ≥ 1, then
  // apportion whatever's left" technique as exact/percentage above,
  // bounding the subset the same way against a possibly-tiny total.
  const payerIds = genSubsetBoundedBy(g, memberIds, total);
  const payers = genPositiveAmountsSummingTo(g, payerIds, total, `${id}-payers`);

  return { id, currency, total, strategy, payers, splits };
}

function genSettlement(g: GeneratorValue, memberIds: readonly string[]): GeneratedSettlement {
  const [from, to] = g(fc.shuffledSubarray<string>, [...memberIds], {
    minLength: 2,
    maxLength: 2,
  }) as [string, string];
  return {
    id: g(fc.uuid),
    from,
    to,
    amount: g(fc.bigInt, { min: 1n, max: 1_000_000n }),
    currency: g(fc.constantFrom, ...CURRENCIES),
  };
}

/** 2–15 members (splitting.md §8) — settlements need at least 2 to have anyone to pay. */
export function genLedger(g: GeneratorValue): GeneratedLedger {
  const memberIds = g(fc.uniqueArray<string, string>, fc.uuid(), { minLength: 2, maxLength: 15 });
  const expenses = Array.from({ length: g(fc.integer, { min: 0, max: 20 }) }, () =>
    genExpense(g, memberIds),
  );
  const settlements = Array.from({ length: g(fc.integer, { min: 0, max: 10 }) }, () =>
    genSettlement(g, memberIds),
  );

  return { memberIds, expenses, settlements };
}
