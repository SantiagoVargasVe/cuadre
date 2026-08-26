/**
 * Raw, un-simplified attribution — what the group sees with simplify
 * *off* (splitting.md §4.1). Also what a simplified edge is explained in
 * terms of, so it has to keep working even while simplification is on.
 */
export interface PairwiseExpense {
  currency: string;
  /** memberId → resolved paid amount. */
  payers: Map<string, bigint>;
  /** memberId → resolved owed amount. */
  splits: Map<string, bigint>;
}

export interface PairwiseSettlement {
  currency: string;
  from: string;
  to: string;
  amount: bigint;
}

export interface PairwiseLedger {
  expenses: PairwiseExpense[];
  settlements: PairwiseSettlement[];
}

export interface PairwiseDebt {
  from: string;
  to: string;
  currency: string;
  amount: bigint;
}

/**
 * Exact per-cell attribution for one expense: `owes[s][p]`, the share of
 * split member `s`'s debt attributed to payer `p`, proportional to what
 * `p` put in.
 *
 * **Not** independent per-split-member `apportion()` calls — that was the
 * first version of this function, and a property test (splitting.md's own
 * "test it, don't assume it" identity) found a real counterexample: each
 * `apportion(split_s, weights=payers)` call exactly preserves *that row's*
 * sum (`Σ_p owes(s→p) = split_s`, by `apportion()`'s own guarantee), but
 * independent rows rounding independently do **not** generally preserve
 * *column* sums (`Σ_s owes(s→p) = paid_p`) — two rows can each round their
 * own remainder unit onto the same payer, or onto none of the payers who
 * needed it, and the errors don't cancel by member.
 *
 * A **second** attempt — floor every cell, then hand out the leftover
 * units one at a time to whichever cell's row *and* column both still
 * needed one, visited in largest-remainder-first order — also failed a
 * property test. That greedy pass assumed every row/column needed at most
 * one leftover unit, true only with two rows or two columns. With three or
 * more payers, a single row's leftover can be as high as `payerCount - 1`,
 * and handing out leftovers by global remainder order isn't guaranteed to
 * find a feasible assignment — this is a genuine bipartite transportation
 * problem, not a flat list to sort once.
 *
 * The construction that *is* exact, for any row/column count — a 2D
 * cumulative-sum difference, the standard technique for controlled
 * rounding of an independence (rank-1) table:
 *
 * 1. Order split members and payers (alphabetically, for determinism) and
 *    take running totals: `rowCum[i] = split_1 + ... + split_i`,
 *    `colCum[j] = paid_1 + ... + paid_j`, each starting at `rowCum[0] =
 *    colCum[0] = 0`.
 * 2. `corner(i, j) = floor(rowCum[i] * colCum[j] / total)` — the exact
 *    real value of `corner` would be `rowCum[i] * colCum[j] / total`
 *    (still rank-1, still separable), so flooring it loses less than 1.
 * 3. `cell(i, j) = corner(i,j) - corner(i-1,j) - corner(i,j-1) +
 *    corner(i-1,j-1)` — a discrete second difference.
 *
 * Why this preserves both margins exactly: summing `cell(i, j)` over all
 * `j` for a fixed row `i` telescopes to `[corner(i, m) - corner(i-1, m)]`
 * (the `j`-indexed terms cancel pairwise), and `corner(i, m) =
 * floor(rowCum[i] * total / total) = rowCum[i]` exactly (no flooring loss
 * once `colCum[j]` reaches `total`). So the row sum is `rowCum[i] -
 * rowCum[i-1] = split_i` exactly — not approximately. The column argument
 * is the same telescoping with the roles of `i`/`j` swapped. Both margins
 * fall out of the *algebra*, not of any greedy choice, which is why this
 * generalizes to any row/column count where the greedy pass didn't.
 *
 * (Each cell also lands within `{floor, ceil}` of its true proportional
 * value `split_i * paid_j / total`, since the real-valued version of this
 * same difference telescopes to exactly that value — so this stays a
 * *rounding* of the proportional attribution, not a reassignment of it.)
 */
function attributeExpense(
  splits: Map<string, bigint>,
  payers: Map<string, bigint>,
  total: bigint,
): Map<string, Map<string, bigint>> {
  const splitIds = [...splits.keys()].sort();
  const payerIds = [...payers.keys()].sort();

  const rowCum: bigint[] = [0n];
  for (const s of splitIds) rowCum.push(rowCum[rowCum.length - 1]! + splits.get(s)!);
  const colCum: bigint[] = [0n];
  for (const p of payerIds) colCum.push(colCum[colCum.length - 1]! + payers.get(p)!);

  const corner = (i: number, j: number): bigint => (rowCum[i]! * colCum[j]!) / total;

  const owes = new Map<string, Map<string, bigint>>();
  for (let i = 0; i < splitIds.length; i++) {
    const row = new Map<string, bigint>();
    owes.set(splitIds[i]!, row);
    for (let j = 0; j < payerIds.length; j++) {
      const cell = corner(i + 1, j + 1) - corner(i, j + 1) - corner(i + 1, j) + corner(i, j);
      row.set(payerIds[j]!, cell);
    }
  }

  return owes;
}

type RawByCurrency = Map<string, Map<string, Map<string, bigint>>>;

function addRaw(raw: RawByCurrency, currency: string, from: string, to: string, amount: bigint): void {
  let byFrom = raw.get(currency);
  if (!byFrom) {
    byFrom = new Map();
    raw.set(currency, byFrom);
  }
  let byTo = byFrom.get(from);
  if (!byTo) {
    byTo = new Map();
    byFrom.set(from, byTo);
  }
  byTo.set(to, (byTo.get(to) ?? 0n) + amount);
}

/**
 * `s` owes `p` a share of `s`'s split proportional to what `p` put in.
 * Self-contributions (`s === p`, when a member is both a payer and a
 * split target) are accumulated too — dropping them here would break the
 * `Σ_s owes(s→p) = paid_p` identity the whole function exists to
 * preserve — and only excluded later, when emitting final edges.
 */
function accumulateExpense(raw: RawByCurrency, expense: PairwiseExpense): void {
  const owes = attributeExpense(expense.splits, expense.payers, sumValues(expense.splits));
  for (const [splitMember, row] of owes) {
    for (const [payer, amount] of row) {
      addRaw(raw, expense.currency, splitMember, payer, amount);
    }
  }
}

function sumValues(map: Map<string, bigint>): bigint {
  let total = 0n;
  for (const value of map.values()) total += value;
  return total;
}

/** A settlement discharges debt in the from→to direction — the inverse of owing it. */
function accumulateSettlement(raw: RawByCurrency, settlement: PairwiseSettlement): void {
  addRaw(raw, settlement.currency, settlement.from, settlement.to, -settlement.amount);
}

/**
 * Nets every ordered pair (a, b) against its reverse (b, a) and keeps only
 * the signed difference — dropping pairs that net to zero and, by
 * construction, every self-pair (its own reverse, so it always nets to
 * zero). Sorted by (currency, from, to) so the output never reshuffles
 * between renders of the same ledger.
 */
export function computePairwise(ledger: PairwiseLedger): PairwiseDebt[] {
  const raw: RawByCurrency = new Map();

  for (const expense of ledger.expenses) accumulateExpense(raw, expense);
  for (const settlement of ledger.settlements) accumulateSettlement(raw, settlement);

  const result: PairwiseDebt[] = [];

  for (const [currency, byFrom] of raw) {
    const members = new Set<string>();
    for (const [from, byTo] of byFrom) {
      members.add(from);
      for (const to of byTo.keys()) members.add(to);
    }
    const sorted = [...members].sort();

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        const aOwesB = byFrom.get(a)?.get(b) ?? 0n;
        const bOwesA = byFrom.get(b)?.get(a) ?? 0n;
        const diff = aOwesB - bOwesA;
        if (diff > 0n) result.push({ from: a, to: b, currency, amount: diff });
        else if (diff < 0n) result.push({ from: b, to: a, currency, amount: -diff });
      }
    }
  }

  return result.sort(
    (x, y) =>
      x.currency.localeCompare(y.currency) ||
      x.from.localeCompare(y.from) ||
      x.to.localeCompare(y.to),
  );
}
