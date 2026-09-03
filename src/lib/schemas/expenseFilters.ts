import { z } from "zod";
import { EXPENSE_CATEGORY_KEYS, type ExpenseCategoryKey } from "../categories";

/**
 * The one thing the category filter can ask for that isn't a category:
 * rows whose `category_key` is NULL. A filter sentinel, never a stored
 * value — putting it in `EXPENSE_CATEGORY_KEYS` would make it a seventh
 * category and a migration (T090, categories.ts).
 */
export const UNCATEGORISED_FILTER = "uncategorised";

export type ExpenseCategoryFilter = ExpenseCategoryKey | typeof UNCATEGORISED_FILTER;

export const EXPENSE_CATEGORY_FILTER_KEYS = [
  ...EXPENSE_CATEGORY_KEYS,
  UNCATEGORISED_FILTER,
] as const;

/** The filter set, minus pagination. Serialization order is this order. */
export const EXPENSE_FILTER_KEYS = ["q", "category", "currency", "member", "from", "to"] as const;

export interface ExpenseFilters {
  q?: string;
  category?: ExpenseCategoryFilter;
  currency?: string;
  member?: string;
  from?: string;
  to?: string;
}

/** Long enough for any real expense title; short enough that the ILIKE
 * pattern stays a pattern rather than a payload. */
const MAX_QUERY_LENGTH = 200;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

// `limit` never rejects: `clampLimit` in services/expenses.ts already owns
// the default and the ceiling, and a garbage value has always fallen back
// to the default rather than 400ing. Same for `cursor`, which
// `decodeCursor` deliberately treats as "no cursor" when it's malformed.
const limitField = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}, z.number().optional());

// Stricter than the create-expense date guard on purpose: a filter bound is
// read straight into a SQL range, so `2026-02-31` has to fail here rather
// than reach Postgres. The year window matches expenses.ts.
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    if (year < 2000 || year > 2100) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "must be a real calendar date between 2000 and 2100");

/**
 * One schema per filter, so the strict route parser and the forgiving page
 * parser below can't drift apart on what a valid value is.
 */
const filterFields = {
  // Trimmed and capped rather than rejected: someone pasting a whole
  // receipt line into the search box should get a search, not a 400.
  q: z
    .preprocess(blankToUndefined, z.string().optional())
    .transform((value) => value?.trim().slice(0, MAX_QUERY_LENGTH) || undefined),
  category: z.preprocess(blankToUndefined, z.enum(EXPENSE_CATEGORY_FILTER_KEYS).optional()),
  // Mirrors src/lib/schemas/expenses.ts — the app's currency shape is an
  // ISO-4217 code, not a closed enum baked into a filter.
  currency: z.preprocess(
    blankToUndefined,
    z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO-4217 code").optional(),
  ),
  member: z.preprocess(blankToUndefined, z.uuid().optional()),
  from: z.preprocess(blankToUndefined, calendarDate.optional()),
  to: z.preprocess(blankToUndefined, calendarDate.optional()),
} as const;

/**
 * The complete feed query, validated at the route boundary so a service
 * only ever receives typed values (backend/CLAUDE.md § Layering). Strict:
 * the feed only ever sends these keys, so an unknown one is a bug or a
 * probe, not something to silently ignore.
 */
export const expenseListQuerySchema = z
  .strictObject({
    cursor: z.preprocess(blankToUndefined, z.string().optional()),
    limit: limitField,
    ...filterFields,
  })
  .refine((value) => !(value.from && value.to) || value.from <= value.to, {
    message: "from must be on or before to",
    path: ["from"],
  });

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

/** Serializes only the filters that are actually set — an empty control
 * must not leave `?category=` behind for the next copied URL to carry. */
export function expenseFiltersToQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams();
  for (const key of EXPENSE_FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function activeExpenseFilterCount(filters: ExpenseFilters): number {
  return EXPENSE_FILTER_KEYS.filter((key) => filters[key]).length;
}

function firstValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = searchParams[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * The page's parser. Deliberately forgiving where the route's is strict: a
 * hand-edited, stale, or truncated URL should render the group with the
 * filters that still make sense, not a 400 the user can't act on. Every
 * value that survives is one the route would also have accepted, so the
 * page and its "Cargar más" requests always agree.
 */
export function parseExpenseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ExpenseFilters {
  // The cast is the one place TypeScript can't follow: indexing
  // `filterFields` with a generic key collapses `safeParse` to the union of
  // every field's output. Each schema does produce its own field's type.
  const read = <K extends keyof typeof filterFields>(
    key: K,
  ): z.output<(typeof filterFields)[K]> | undefined => {
    const parsed = filterFields[key].safeParse(firstValue(searchParams, key));
    return parsed.success ? (parsed.data as z.output<(typeof filterFields)[K]>) : undefined;
  };

  const from = read("from");
  const to = read("to");
  // An inverted range is the one cross-field rule; dropping both bounds
  // beats guessing which end the user meant.
  const validRange = !(from && to) || from <= to;

  return {
    q: read("q"),
    category: read("category"),
    currency: read("currency"),
    member: read("member"),
    from: validRange ? from : undefined,
    to: validRange ? to : undefined,
  };
}
