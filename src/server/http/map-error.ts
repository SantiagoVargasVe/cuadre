import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { DomainError, RateLimitError } from "../errors";

/**
 * The one place a thrown DomainError becomes the wire shape from
 * api-contract.md: `{ error: { code, message, details } }`. Anything
 * that isn't a DomainError is unexpected — logged with a request id and
 * turned into a generic 500 whose body carries nothing internal (no
 * stack, no driver error, no message that might embed a query or a
 * value). That request id is the only thing worth correlating a support
 * report back to a log line by.
 *
 * Never log a DomainError's own `details` here beyond what's already
 * safe to hand back to the client — and never construct a DomainError
 * whose message or details embed a password hash, a token, a rate-limit
 * key, or an email address (docs/context/security.md § Secrets).
 */
export function mapErrorToResponse(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    const headers =
      error instanceof RateLimitError
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined;

    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers },
    );
  }

  const requestId = randomUUID();
  console.error(`[${requestId}] unhandled error in route handler:`, error);

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: { requestId } } },
    { status: 500 },
  );
}

/**
 * Wraps a route handler so it never has to build an error response
 * itself — throw a DomainError (or let one bubble up from a service) and
 * this catches it. Route handlers stay "Zod parse → call service →
 * serialize. Nothing else." (backend/CLAUDE.md § Layering).
 */
export function withErrorHandling(
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      return mapErrorToResponse(error);
    }
  };
}
