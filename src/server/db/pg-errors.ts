import "server-only";

/**
 * drizzle-orm wraps the driver's error in its own DrizzleQueryError, with
 * the real postgres.js PostgresError (the one carrying the SQLSTATE code)
 * attached via `.cause` — confirmed empirically, not documented anywhere
 * obvious. Checking `error.code` alone silently never matches.
 */
function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") return code;
  return pgErrorCode((error as { cause?: unknown }).cause);
}

const UNIQUE_VIOLATION = "23505";

/** True for a unique-constraint violation (SQLSTATE 23505) — a duplicate email, a double membership. */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === UNIQUE_VIOLATION;
}
