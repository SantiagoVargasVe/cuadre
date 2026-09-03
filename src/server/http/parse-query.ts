import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Validate a URL's query string against a Zod schema, in the same shape
 * `parseBody` gives a route handler for a JSON body: a failed parse is a
 * `400` carrying no further detail (api-contract.md § Conventions), so a
 * probe learns nothing about which parameter it got wrong.
 *
 * Repeated parameters collapse to the last occurrence — `Object.fromEntries`
 * over `URLSearchParams`. Every filter here is single-valued, and picking
 * one deterministically beats rejecting a link that got a duplicate key
 * appended somewhere along the way.
 */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>,
): { data: T } | { error: NextResponse } {
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" } },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}
