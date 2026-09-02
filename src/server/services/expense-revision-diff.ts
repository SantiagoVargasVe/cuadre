import { z } from "zod";
import type { Money } from "../../lib/money/types";

const amountSchema = z.string().regex(/^\d+$/);
const partySchema = z.object({ userId: z.string(), amount: amountSchema });

/**
 * Snapshots are durable JSON written by earlier versions of the app. Parse
 * rather than cast them, and strip unknown keys so an accidental future
 * snapshot field can never become part of this endpoint's response.
 */
const snapshotSchema = z.object({
  title: z.string().optional(),
  expenseDate: z.string().optional(),
  totalAmount: amountSchema.optional(),
  currency: z.string().optional(),
  splitStrategy: z.string().optional(),
  payers: z.array(partySchema).optional(),
  splits: z.array(partySchema).optional(),
});

export type ExpenseSnapshot = z.infer<typeof snapshotSchema>;
export type TextField = "title" | "expenseDate" | "splitStrategy" | "currency";
export type PartyField = "payers" | "splits";

export type RevisionChange =
  | { kind: "text"; field: TextField; from: string; to: string }
  | { kind: "money"; field: "totalAmount"; from: Money; to: Money }
  | {
      kind: "party";
      field: PartyField;
      userId: string;
      displayName: string | null;
      change: "added" | "removed" | "changed";
      from: Money | null;
      to: Money | null;
    };

export type NameLookup = (userId: string) => string | null;

export function parseSnapshot(value: unknown): ExpenseSnapshot | null {
  const parsed = snapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function money(amount: string | undefined, currency: string | undefined): Money | null {
  return amount === undefined || currency === undefined ? null : { amount: BigInt(amount), currency };
}

function textChange(field: TextField, from?: string, to?: string): RevisionChange | null {
  if (from === undefined || to === undefined || from === to) return null;
  return { kind: "text", field, from, to };
}

function totalChange(previous: ExpenseSnapshot, current: ExpenseSnapshot): RevisionChange | null {
  const from = money(previous.totalAmount, previous.currency);
  const to = money(current.totalAmount, current.currency);
  if (!from || !to || (from.amount === to.amount && from.currency === to.currency)) return null;
  return { kind: "money", field: "totalAmount", from, to };
}

function amountsByUser(parties: { userId: string; amount: string }[] | undefined): Map<string, string> {
  return new Map((parties ?? []).map((party) => [party.userId, party.amount]));
}

function diffParties(
  field: PartyField,
  previous: ExpenseSnapshot,
  current: ExpenseSnapshot,
  nameOf: NameLookup,
): RevisionChange[] {
  if (previous[field] === undefined || current[field] === undefined) return [];

  const before = amountsByUser(previous[field]);
  const after = amountsByUser(current[field]);
  const changes: RevisionChange[] = [];

  for (const userId of new Set([...before.keys(), ...after.keys()])) {
    const from = money(before.get(userId), previous.currency);
    const to = money(after.get(userId), current.currency);
    if (!from && !to) continue;
    if (from && to && from.amount === to.amount && from.currency === to.currency) continue;
    changes.push({
      kind: "party",
      field,
      userId,
      displayName: nameOf(userId),
      change: !from ? "added" : !to ? "removed" : "changed",
      from,
      to,
    });
  }
  return changes;
}

/** Diffs consecutive snapshots in domain values; serialization happens only in the route. */
export function diffSnapshots(
  previous: ExpenseSnapshot | null,
  current: ExpenseSnapshot | null,
  nameOf: NameLookup,
): RevisionChange[] {
  if (!previous || !current) return [];

  const fields = [
    textChange("title", previous.title, current.title),
    textChange("expenseDate", previous.expenseDate, current.expenseDate),
    totalChange(previous, current),
    textChange("currency", previous.currency, current.currency),
    textChange("splitStrategy", previous.splitStrategy, current.splitStrategy),
  ].filter((change): change is RevisionChange => change !== null);

  return [...fields, ...diffParties("payers", previous, current, nameOf), ...diffParties("splits", previous, current, nameOf)];
}
