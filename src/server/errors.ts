/**
 * Typed domain errors. Services (and the auth/session/rate-limit helpers
 * route handlers call directly) throw these instead of building a response
 * — src/server/http/map-error.ts is the one place that turns them into the
 * wire format from docs/context/api-contract.md.
 *
 * `code` is per-throw-site, not fixed per class: the class picks the HTTP
 * status, the caller picks the specific reason — `new
 * ConflictError("EMAIL_ALREADY_REGISTERED", "...")` and `new
 * ConflictError("INVITE_ALREADY_CONSUMED", "...")` are both 409s with
 * different codes the client can branch on.
 */
export abstract class DomainError extends Error {
  abstract readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** No session, or an invalid/expired token. Also used for "wrong credentials" — see security.md. */
export class UnauthorizedError extends DomainError {
  readonly status = 401;
  constructor(
    code = "UNAUTHORIZED",
    message = "Authentication required",
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "UnauthorizedError";
  }
}

/** A member, but this action needs owner — or an Origin that doesn't match APP_URL. */
export class ForbiddenError extends DomainError {
  readonly status = 403;
  constructor(
    code = "FORBIDDEN",
    message = "You do not have permission to do this",
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "ForbiddenError";
  }
}

/** Doesn't exist — or the caller isn't a member of the group it's in (api-contract.md). */
export class NotFoundError extends DomainError {
  readonly status = 404;
  constructor(code = "NOT_FOUND", message = "Not found", details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = "NotFoundError";
  }
}

/** Invite already consumed, duplicate email, member already in group, and similar. */
export class ConflictError extends DomainError {
  readonly status = 409;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = "ConflictError";
  }
}

/** Well-formed but domain-invalid: splits don't balance, percentages don't sum, etc. */
export class ValidationError extends DomainError {
  readonly status = 422;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = "ValidationError";
  }
}

/**
 * A recovery/verification token that didn't claim a row — invalid, expired,
 * already used, unknown, or presented to the wrong purpose. Every one of
 * those is deliberately indistinguishable to the caller: one `400`, one
 * code, one message, **no `details`**. Anything more tells a prober which
 * of the five they hit (ADR-0012 § Enumeration, ADR-0013). `400` rather
 * than `401` because there is no session in play — the link itself is the
 * whole credential, and it's the input that's bad.
 */
export class InvalidAuthTokenError extends DomainError {
  readonly status = 400;
  constructor() {
    super("INVALID_TOKEN", "This link is invalid or has expired");
    this.name = "InvalidAuthTokenError";
  }
}

/** The mapper adds Retry-After from retryAfterSeconds. */
export class RateLimitError extends DomainError {
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, code = "RATE_LIMITED", message = "Too many requests") {
    super(code, message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
