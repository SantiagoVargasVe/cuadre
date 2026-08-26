import { UnbalancedLedgerError } from "./errors";

/**
 * Flat ledger entries — one per (currency, member, amount) contribution.
 * Deliberately not grouped by expense: net balances are a pure sum over
 * every contribution, and which expense a contribution came from only
 * matters for pairwise attribution (T041), not for this function.
 */
export interface LedgerEntry {
  currency: string;
  memberId: string;
  amount: bigint;
}

export interface Ledger {
  /** From expense_payers, already filtered to live (non-deleted) expenses. */
  paid: LedgerEntry[];
  /** From expense_splits, same filter. */
  owed: LedgerEntry[];
  /** From settlements' from_user_id — empty until T043 adds the table. */
  sent: LedgerEntry[];
  /** From settlements' to_user_id — empty until T043 adds the table. */
  received: LedgerEntry[];
}

export interface Balance {
  paid: bigint;
  owed: bigint;
  sent: bigint;
  received: bigint;
  net: bigint;
}

function emptyBalance(): Balance {
  return { paid: 0n, owed: 0n, sent: 0n, received: 0n, net: 0n };
}

function ensure(
  byCurrency: Map<string, Map<string, Balance>>,
  currency: string,
  memberId: string,
): Balance {
  let byMember = byCurrency.get(currency);
  if (!byMember) {
    byMember = new Map();
    byCurrency.set(currency, byMember);
  }
  let balance = byMember.get(memberId);
  if (!balance) {
    balance = emptyBalance();
    byMember.set(memberId, balance);
  }
  return balance;
}

/**
 * Net position per member, per currency (splitting.md §4):
 * `net = paid − owed + sent − received`. Positive means the group owes
 * them; negative means they owe the group.
 *
 * Currencies are computed **independently** — a member can be up in COP
 * and down in USD, and those are never summed together. A member with no
 * activity in a currency simply doesn't appear in that currency's map,
 * including a removed member with historical rows in another one.
 *
 * `Σ net == 0` is asserted per currency and **throws** on failure rather
 * than returning a plausible-looking number — this is the canary for
 * every class of bug in this app. One pass over the ledger; no N+1.
 */
export function computeBalances(ledger: Ledger): Map<string, Map<string, Balance>> {
  const byCurrency = new Map<string, Map<string, Balance>>();

  for (const { currency, memberId, amount } of ledger.paid) {
    ensure(byCurrency, currency, memberId).paid += amount;
  }
  for (const { currency, memberId, amount } of ledger.owed) {
    ensure(byCurrency, currency, memberId).owed += amount;
  }
  for (const { currency, memberId, amount } of ledger.sent) {
    ensure(byCurrency, currency, memberId).sent += amount;
  }
  for (const { currency, memberId, amount } of ledger.received) {
    ensure(byCurrency, currency, memberId).received += amount;
  }

  for (const [currency, byMember] of byCurrency) {
    let total = 0n;
    for (const balance of byMember.values()) {
      balance.net = balance.paid - balance.owed + balance.sent - balance.received;
      total += balance.net;
    }
    if (total !== 0n) throw new UnbalancedLedgerError(currency, total);
  }

  return byCurrency;
}
