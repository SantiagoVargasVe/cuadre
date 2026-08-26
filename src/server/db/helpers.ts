import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { expenses } from "./schema";

/**
 * The group feed's only query (data-model.md § Query rules). Always read
 * live expenses through this helper rather than filtering `deleted_at` by
 * hand at each call site — that's the one thing a future service is
 * guaranteed to forget.
 */
export function liveExpenses(groupId: string) {
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.expenseDate));
}
