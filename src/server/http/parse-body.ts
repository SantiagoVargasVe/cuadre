import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Parse and validate a JSON body against a Zod schema, in the shape every
 * route handler needs: bad JSON and a failed parse are both a `400` with no
 * further detail (api-contract.md), matching what auth's routes did inline
 * before there were enough call sites here to justify sharing it.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data };
}
