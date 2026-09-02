import "server-only";
import { eq } from "drizzle-orm";
import { toCsvDocument } from "../../lib/csv";
import { db } from "../db/client";
import { groups } from "../db/schema";
import {
  listAllExpensesForExport,
  type ExpenseForExport,
  type ExpensePartyWithName,
} from "./expenses";

/**
 * One row per expense. Payers and resolved splits are JSON arrays in their
 * own cells, so multiple payers and non-equal splits survive a spreadsheet
 * round trip without turning this into a lossy summary report.
 */
export const EXPENSE_CSV_COLUMNS = [
  "expense_id",
  "date",
  "title",
  "amount_minor",
  "currency",
  "split_strategy",
  "payers",
  "splits",
  "created_at",
  "updated_at",
] as const;

/** Stable output: two exports of an unchanged group must be byte-identical,
 * and the DB gives no order within an expense's splits. */
function orderedParties(parties: ExpensePartyWithName[]): ExpensePartyWithName[] {
  return [...parties].sort(
    (a, b) => a.userId.localeCompare(b.userId),
  );
}

function partyJson(parties: ExpensePartyWithName[]): string {
  return JSON.stringify(orderedParties(parties));
}

function rowForExpense(expense: ExpenseForExport): string[] {
  return [
    expense.id,
    expense.date,
    expense.title,
    expense.total.amount,
    expense.total.currency,
    expense.strategy,
    partyJson(expense.payers),
    partyJson(expense.splits),
    expense.createdAt,
    expense.updatedAt,
  ];
}

/** Pure: rows in, CSV text out. Separated from the read so the shape can be
 * tested without a database, and so the read stays the only thing that
 * needs authorizing. */
export function buildExpensesCsv(expenses: ExpenseForExport[]): string {
  return toCsvDocument(EXPENSE_CSV_COLUMNS, expenses.map(rowForExpense));
}

/** ASCII-only, so the quoted `filename=` in `Content-Disposition` needs no
 * RFC 5987 encoding and no browser has to guess. Accents fold rather than
 * disappear — "Cartagena Ñ 2026" is `cartagena-n-2026`, not `cartagena-2026`. */
function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "grupo";
}

/** UTC, matching every other date this app stamps server-side. */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ExpensesCsvExport {
  filename: string;
  csv: string;
}

/**
 * The group's whole ledger as CSV (T080) — the escape hatch, so it is
 * available to **every member**, not just the owner.
 *
 * Authorization happens inside `listAllExpensesForExport`, which is the
 * only thing here that reads group-scoped data: a non-member and a removed
 * member both get `NotFoundError` → `404`, never a `403` and never an empty
 * file (security.md § *Non-membership is 404*). The group title read below
 * runs after that check, so it can't leak a title to an outsider.
 *
 * Display currency is deliberately irrelevant here: this is an entered
 * ledger export, not a converted balance report. Each row retains its own
 * currency and no cross-currency aggregate is calculated.
 */
export async function exportExpensesCsv(
  groupId: string,
  userId: string,
): Promise<ExpensesCsvExport> {
  const expenses = await listAllExpensesForExport(groupId, userId);
  const [group] = await db
    .select({ title: groups.title })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  return {
    filename: `${slugify(group?.title ?? "")}-gastos-${todayUtcDate()}.csv`,
    csv: buildExpensesCsv(expenses),
  };
}
